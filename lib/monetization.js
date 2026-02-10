"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");

let stripeClient = null;

function getEnv(name, fallback) {
  if (typeof process.env[name] === "string" && process.env[name] !== "") {
    return process.env[name];
  }
  return fallback;
}

function getStripeClient() {
  const secretKey = getEnv("STRIPE_SECRET_KEY", "");
  if (!secretKey) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

function hasPaymentEnv() {
  return !!(getEnv("STRIPE_SECRET_KEY", "") && getEnv("STRIPE_PRICE_ID", "") && getEnv("UNLOCK_TOKEN_SECRET", ""));
}

function hasAdsEnv() {
  return getEnv("ADS_ENABLED", "false") === "true" && !!(getEnv("ADSENSE_CLIENT_ID", "") && getEnv("ADSENSE_SLOT_ID", ""));
}

function getPublicConfig() {
  return {
    paymentsEnabled: hasPaymentEnv(),
    adsEnabled: hasAdsEnv(),
    adsenseClientId: getEnv("ADSENSE_CLIENT_ID", ""),
    adsenseSlotId: getEnv("ADSENSE_SLOT_ID", ""),
    priceLabel: getEnv("PRICE_LABEL", "$3.99"),
    vercelEnv: getEnv("VERCEL_ENV", "development"),
  };
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

function getBaseUrl(req) {
  const explicitBase = getEnv("APP_BASE_URL", "");
  if (explicitBase) {
    return explicitBase;
  }
  const host = req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  if (typeof host === "string" && host.length > 0) {
    return proto + "://" + host;
  }
  return "http://localhost:3000";
}

function signUnlockToken(session) {
  const tokenSecret = getEnv("UNLOCK_TOKEN_SECRET", "");
  if (!tokenSecret) {
    throw new Error("Unlock token secret is missing.");
  }

  return jwt.sign(
    {
      sid: session.id,
      pi: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id,
      em: session.customer_details && session.customer_details.email ? session.customer_details.email : null,
      unlocked: true,
      scope: "premium_export",
    },
    tokenSecret,
    {
      algorithm: "HS256",
      expiresIn: "365d",
      jwtid: crypto.randomUUID(),
    }
  );
}

function verifyUnlockToken(token) {
  const tokenSecret = getEnv("UNLOCK_TOKEN_SECRET", "");
  if (!tokenSecret) {
    throw new Error("Unlock token secret is missing.");
  }
  return jwt.verify(token, tokenSecret, { algorithms: ["HS256"] });
}

module.exports = {
  getEnv,
  getStripeClient,
  getPublicConfig,
  safePath,
  getBaseUrl,
  hasPaymentEnv,
  signUnlockToken,
  verifyUnlockToken,
};
