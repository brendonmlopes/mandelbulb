"use strict";

const { getEnv, getStripeClient } = require("../lib/monetization");
const { methodGuard, rateLimit, readRawBody, requireEnvVars, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ["POST"])) {
    return;
  }
  if (!rateLimit(req, res)) {
    return;
  }
  if (!requireEnvVars(res, ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"])) {
    return;
  }

  const stripe = getStripeClient();
  if (!stripe) {
    sendJson(res, 503, { error: "Payments unavailable." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || signature.length === 0) {
    sendJson(res, 400, { error: "Missing Stripe signature." });
    return;
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (_error) {
    sendJson(res, 400, { error: "Invalid webhook payload." });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getEnv("STRIPE_WEBHOOK_SECRET", ""));
  } catch (_error) {
    sendJson(res, 400, { error: "Invalid webhook signature." });
    return;
  }

  if (event.type === "checkout.session.completed") {
    sendJson(res, 200, { received: true });
    return;
  }

  sendJson(res, 200, { received: true });
};
