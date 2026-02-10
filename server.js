"use strict";

const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: false,
});
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "";
const UNLOCK_TOKEN_SECRET = process.env.UNLOCK_TOKEN_SECRET || "";
const ADS_ENABLED = String(process.env.ADS_ENABLED || "false") === "true";
const ADSENSE_CLIENT_ID = process.env.ADSENSE_CLIENT_ID || "";
const ADSENSE_SLOT_ID = process.env.ADSENSE_SLOT_ID || "";
const PRICE_LABEL = process.env.PRICE_LABEL || "$3.99";

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const missingPaymentEnv = ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "UNLOCK_TOKEN_SECRET"].filter(
  (name) => !process.env[name]
);

if (missingPaymentEnv.length > 0) {
  console.warn("Payments disabled: missing environment variables: " + missingPaymentEnv.join(", "));
}

const rateState = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQUESTS = 60;

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = getClientIp(req);
  const rec = rateState.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };

  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + RATE_WINDOW_MS;
  }

  rec.count += 1;
  rateState.set(ip, rec);

  if (rec.count > RATE_MAX_REQUESTS) {
    res.status(429).json({ error: "Too many requests." });
    return;
  }

  next();
}

function requireEnvVars(res, names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    res.status(503).json({ error: "Server not fully configured." });
    return false;
  }
  return true;
}

function safePath(input, fallback) {
  if (typeof input !== "string") {
    return fallback;
  }
  if (!input.startsWith("/") || input.startsWith("//")) {
    return fallback;
  }
  return input;
}

function getPublicConfig() {
  return {
    paymentsEnabled: !!(STRIPE_SECRET_KEY && STRIPE_PRICE_ID && UNLOCK_TOKEN_SECRET),
    adsEnabled: ADS_ENABLED && !!(ADSENSE_CLIENT_ID && ADSENSE_SLOT_ID),
    adsenseClientId: ADSENSE_CLIENT_ID,
    adsenseSlotId: ADSENSE_SLOT_ID,
    priceLabel: PRICE_LABEL,
  };
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://pagead2.googlesyndication.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        frameSrc: ["https://googleads.g.doubleclick.net", "https://tpc.googlesyndication.com"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "no-referrer" },
  })
);

app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async function webhook(req, res) {
  if (!requireEnvVars(res, ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"])) {
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET);
  } catch (_error) {
    res.status(400).send("Invalid webhook signature");
    return;
  }

  if (event.type === "checkout.session.completed") {
    res.status(200).json({ received: true });
    return;
  }

  res.status(200).json({ received: true });
});

app.use(express.json({ limit: "200kb" }));
app.use(rateLimit);

app.get("/api/public-config", function publicConfig(_req, res) {
  res.json(getPublicConfig());
});

app.post("/api/create-checkout-session", async function createCheckout(req, res) {
  if (!requireEnvVars(res, ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "UNLOCK_TOKEN_SECRET"])) {
    return;
  }

  const successPath = safePath(req.body && req.body.successPath, "/");
  const cancelPath = safePath(req.body && req.body.cancelPath, "/");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: APP_BASE_URL + successPath + "?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: APP_BASE_URL + cancelPath + "?checkout=cancel",
      metadata: {
        product: "premium_export_unlock",
      },
    });

    res.json({ url: session.url });
  } catch (_error) {
    res.status(500).json({ error: "Failed to create checkout session." });
  }
});

app.post("/api/verify-unlock", async function verifyUnlock(req, res) {
  if (!requireEnvVars(res, ["STRIPE_SECRET_KEY", "UNLOCK_TOKEN_SECRET"])) {
    return;
  }

  const sessionId = req.body && req.body.sessionId;
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
    const isPaid = session && session.payment_status === "paid" && session.status === "complete";

    if (!isPaid) {
      res.status(402).json({ error: "Payment not completed." });
      return;
    }

    const token = jwt.sign(
      {
        sid: session.id,
        pi: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id,
        em: session.customer_details && session.customer_details.email ? session.customer_details.email : null,
        unlocked: true,
        scope: "premium_export",
      },
      UNLOCK_TOKEN_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "365d",
        jwtid: crypto.randomUUID(),
      }
    );

    res.json({
      unlocked: true,
      token: token,
      expiresInDays: 365,
    });
  } catch (_error) {
    res.status(500).json({ error: "Could not verify purchase." });
  }
});

app.post("/api/validate-unlock", function validateUnlock(req, res) {
  if (!requireEnvVars(res, ["UNLOCK_TOKEN_SECRET"])) {
    return;
  }

  const token = req.body && req.body.token;
  if (typeof token !== "string" || token.length > 5000) {
    res.status(400).json({ valid: false });
    return;
  }

  try {
    const decoded = jwt.verify(token, UNLOCK_TOKEN_SECRET, { algorithms: ["HS256"] });
    if (!decoded || decoded.scope !== "premium_export" || decoded.unlocked !== true) {
      res.status(401).json({ valid: false });
      return;
    }

    res.json({ valid: true, unlocked: true });
  } catch (_error) {
    res.status(401).json({ valid: false });
  }
});

app.use(express.static(path.join(__dirname), { extensions: ["html"] }));

app.get("*", function fallback(_req, res) {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, function startServer() {
  console.log("Mandelbulb web app listening on port " + PORT);
});
