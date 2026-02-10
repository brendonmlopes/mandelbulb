"use strict";

const { verifyUnlockToken } = require("../lib/monetization");
const { methodGuard, parseJsonBody, rateLimit, requireEnvVars, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ["POST"])) {
    return;
  }
  if (!rateLimit(req, res)) {
    return;
  }
  if (!requireEnvVars(res, ["UNLOCK_TOKEN_SECRET"])) {
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const token = body && body.token;
    if (typeof token !== "string" || token.length > 5000) {
      sendJson(res, 400, { valid: false });
      return;
    }

    const decoded = verifyUnlockToken(token);
    if (!decoded || decoded.scope !== "premium_export" || decoded.unlocked !== true) {
      sendJson(res, 401, { valid: false });
      return;
    }

    sendJson(res, 200, { valid: true, unlocked: true });
  } catch (_error) {
    sendJson(res, 401, { valid: false });
  }
};
