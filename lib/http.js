"use strict";

const rateState = global.__mandelbulbRateState || new Map();
if (!global.__mandelbulbRateState) {
  global.__mandelbulbRateState = rateState;
}

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQUESTS = 60;
const BODY_LIMIT_BYTES = 200 * 1024;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function methodGuard(req, res, methods) {
  if (!methods.includes(req.method)) {
    res.setHeader("Allow", methods.join(", "));
    sendJson(res, 405, { error: "Method not allowed." });
    return false;
  }
  return true;
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function rateLimit(req, res) {
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
    sendJson(res, 429, { error: "Too many requests." });
    return false;
  }

  return true;
}

async function readRawBody(req) {
  return new Promise(function readPromise(resolve, reject) {
    const chunks = [];
    let total = 0;

    req.on("data", function onData(chunk) {
      total += chunk.length;
      if (total > BODY_LIMIT_BYTES) {
        reject(new Error("Body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", function onEnd() {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", function onError(error) {
      reject(error);
    });
  });
}

async function parseJsonBody(req) {
  const raw = await readRawBody(req);
  if (!raw || raw.length === 0) {
    return {};
  }
  return JSON.parse(raw.toString("utf8"));
}

function requireEnvVars(res, names) {
  const missing = names.filter(function missingFilter(name) {
    return !process.env[name];
  });
  if (missing.length > 0) {
    sendJson(res, 503, { error: "Server not fully configured." });
    return false;
  }
  return true;
}

module.exports = {
  sendJson,
  methodGuard,
  rateLimit,
  readRawBody,
  parseJsonBody,
  requireEnvVars,
};
