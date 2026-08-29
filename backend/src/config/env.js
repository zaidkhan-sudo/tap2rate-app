require("dotenv").config();

function parseList(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const DURATION_PATTERN = /^\d+(ms|s|m|h|d)$/;

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  qrBaseUrl: process.env.QR_BASE_URL,

  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",

  adminSetupEmail: (process.env.ADMIN_SETUP_EMAIL || "").trim().toLowerCase(),

  emailHost: process.env.EMAIL_HOST,
  emailPort: Number(process.env.EMAIL_PORT) || 587,
  emailSecure: process.env.EMAIL_SECURE === "true",
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,
  emailFrom: process.env.EMAIL_FROM,

  adminOrigins: parseList(process.env.ADMIN_ORIGINS),
  adminFrontendUrl: (process.env.ADMIN_FRONTEND_URL || "").trim().replace(/\/+$/, ""),

  refreshCookieName: "qr_admin_refresh",
};

env.cookieSecure = env.isProd ? true : process.env.COOKIE_SECURE === "true";

const CORE_REQUIRED = ["mongoUri", "qrBaseUrl"];

const AUTH_REQUIRED_IN_PROD = ["accessTokenSecret", "adminFrontendUrl", "adminOrigins"];

function validateEnv() {
  const missingCore = CORE_REQUIRED.filter((key) => !env[key]);
  if (missingCore.length > 0) {
    throw new Error(`Missing required environment variables: ${missingCore.join(", ")}`);
  }

  if (env.accessTokenSecret && env.accessTokenSecret.length < 32) {
    throw new Error("ACCESS_TOKEN_SECRET must be at least 32 characters");
  }

  if (!DURATION_PATTERN.test(env.refreshTokenExpiresIn)) {
    throw new Error("REFRESH_TOKEN_EXPIRES_IN must be a duration like 30m, 12h, or 7d");
  }

  if (!DURATION_PATTERN.test(env.accessTokenExpiresIn)) {
    throw new Error("ACCESS_TOKEN_EXPIRES_IN must be a duration like 10m, 15m, or 1h");
  }

  if (env.isProd) {
    const missingAuth = AUTH_REQUIRED_IN_PROD.filter(
      (key) => !env[key] || (Array.isArray(env[key]) && env[key].length === 0)
    );
    if (missingAuth.length > 0) {
      throw new Error(
        `Missing required environment variables for authentication: ${missingAuth.join(", ")}`
      );
    }
  } else if (!env.accessTokenSecret) {
    console.warn("[env] Authentication not fully configured; admin login will be unavailable.");
  }

  if (
    (!env.emailHost || !env.emailUser || !env.emailPass) &&
    (!process.env.GOOGLE_USER || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
  ) {
    console.warn("[env] Email service not configured; OTP emails will fail until it is set up.");
  }
}

module.exports = { env, validateEnv };
