"use strict";

const { getPublicConfig } = require("../lib/monetization");
const { methodGuard, rateLimit, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, ["GET"])) {
    return;
  }
  if (!rateLimit(req, res)) {
    return;
  }

  sendJson(res, 200, getPublicConfig());
};
