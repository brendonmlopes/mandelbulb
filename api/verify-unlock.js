"use strict";

const { getStripeClient, signUnlockToken } = require("../lib/monetization");
const { methodGuard, parseJsonBody, rateLimit, requireEnvVars, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ["POST"])) {
    return;
  }
  if (!rateLimit(req, res)) {
    return;
  }
  if (!requireEnvVars(res, ["STRIPE_SECRET_KEY", "UNLOCK_TOKEN_SECRET"])) {
    return;
  }

  const stripe = getStripeClient();
  if (!stripe) {
    sendJson(res, 503, { error: "Payments unavailable." });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const sessionId = body && body.sessionId;
    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      sendJson(res, 400, { error: "Invalid session id." });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
    const isPaid = session && session.payment_status === "paid" && session.status === "complete";

    if (!isPaid) {
      sendJson(res, 402, { error: "Payment not completed." });
      return;
    }

    const token = signUnlockToken(session);
    sendJson(res, 200, {
      unlocked: true,
      token: token,
      expiresInDays: 365,
    });
  } catch (_error) {
    sendJson(res, 500, { error: "Could not verify purchase." });
  }
};
