const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const { env } = require("../config/env");

const REFRESH_TOKEN_BYTES = 32;
const JWT_ALGORITHM = "HS256";

const DURATION_UNIT_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

function unauthorized() {
  const err = new Error("Unauthorized");
  err.statusCode = 401;
  return err;
}

function parseDurationMs(duration) {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration);
  if (!match) {
    return null;
  }
  return Number(match[1]) * DURATION_UNIT_MS[match[2]];
}

function generateRefreshToken() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(payload) {
  return jwt.sign(payload, env.accessTokenSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.accessTokenExpiresIn,
  });
}

function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, env.accessTokenSecret, {
      algorithms: [JWT_ALGORITHM],
    });

    if (!decoded || typeof decoded.id !== "string" || typeof decoded.sessionId !== "string") {
      throw unauthorized();
    }

    return { userId: decoded.id, sessionId: decoded.sessionId };
  } catch {
    throw unauthorized();
  }
}

module.exports = {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  parseDurationMs,
};
