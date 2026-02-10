"use strict";

const { getBaseUrl, getEnv, getStripeClient, safePath } = require("../lib/monetization");
const { methodGuard, parseJsonBody, rateLimit, requireEnvVars, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ["POST"])) {
    return;
  }
  if (!rateLimit(req, res)) {
    return;
  }
  if (!requireEnvVars(res, ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "UNLOCK_TOKEN_SECRET"])) {
    return;
  }

  const stripe = getStripeClient();
  if (!stripe) {
    sendJson(res, 503, { error: "Payments unavailable." });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const successPath = safePath(body && body.successPath, "/");
    const cancelPath = safePath(body && body.cancelPath, "/");
    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: getEnv("STRIPE_PRICE_ID", ""), quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: baseUrl + successPath + "?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: baseUrl + cancelPath + "?checkout=cancel",
      metadata: {
        product: "premium_export_unlock",
      },
    });

    sendJson(res, 200, { url: session.url });
  } catch (_error) {
    sendJson(res, 500, { error: "Failed to create checkout session." });
  }
};
