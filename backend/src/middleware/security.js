const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const { env } = require("../config/env");

function corsOptionsDelegate(req, callback) {
  const origin = req.headers.origin;

  if (!origin || env.adminOrigins.includes(origin)) {
    callback(null, { origin: true, credentials: true });
    return;
  }

  callback(null, { origin: false });
}

function rateLimitMessage(message) {
  return {
    success: false,
    message,
  };
}

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitMessage("Too many requests, please slow down"),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitMessage("Too many login attempts, try again later"),
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitMessage("Too many verification attempts, try again later"),
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitMessage("Too many refresh requests, try again later"),
});

const adminApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitMessage("Too many requests, please slow down"),
});

module.exports = {
  helmetMiddleware: helmet(),
  corsHandler: cors(corsOptionsDelegate),
  cookieParserMiddleware: cookieParser(),
  publicLimiter,
  loginLimiter,
  otpLimiter,
  refreshLimiter,
  adminApiLimiter,
};
