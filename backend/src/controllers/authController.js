const authService = require("../services/authService");
const otpService = require("../services/otpService");
const User = require("../models/User");
const { env } = require("../config/env");
const { parseDurationMs } = require("../utils/tokens");

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function requireJsonObject(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw httpError(400, "Request body must be a JSON object");
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: parseDurationMs(env.refreshTokenExpiresIn),
  };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(env.refreshCookieName, refreshToken, cookieOptions());
}

function clearRefreshCookie(res) {
  const { maxAge, ...clearOptions } = cookieOptions();
  res.clearCookie(env.refreshCookieName, clearOptions);
}

function getClientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "";
}

async function login(req, res) {
  requireJsonObject(req.body);

  if (typeof req.body.email !== "string" || typeof req.body.password !== "string") {
    throw httpError(400, "Email and password are required");
  }

  const result = await authService.login(
    req.body.email,
    req.body.password,
    getClientIp(req),
    req.headers["user-agent"]
  );

  setRefreshCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
}

async function verifyEmail(req, res) {
  requireJsonObject(req.body);

  if (typeof req.body.email !== "string" || typeof req.body.otp !== "string") {
    throw httpError(400, "Email and verification code are required");
  }

  await otpService.verifyOtp(req.body.email, req.body.otp);

  const normalizedEmail = req.body.email.trim().toLowerCase();
  await User.updateOne({ email: normalizedEmail }, { $set: { verified: true } });

  res.status(200).json({
    success: true,
    message: "Email verified. You can now log in.",
  });
}

async function resendOtp(req, res) {
  requireJsonObject(req.body);

  if (typeof req.body.email !== "string") {
    throw httpError(400, "Email is required");
  }

  const normalizedEmail = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (user && !user.verified && user.active) {
    await otpService.issueOtp(normalizedEmail);
  }

  res.status(200).json({
    success: true,
    message: "If your account requires verification, a new code has been sent.",
  });
}

async function refresh(req, res) {
  const rawToken = req.cookies[env.refreshCookieName];

  const result = await authService.rotateSession(
    rawToken,
    getClientIp(req),
    req.headers["user-agent"]
  );

  setRefreshCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    data: {
      accessToken: result.accessToken,
    },
  });
}

async function logout(req, res) {
  const rawToken = req.cookies[env.refreshCookieName];
  await authService.revokeSessionByToken(rawToken);
  clearRefreshCookie(res);

  res.status(200).json({ success: true, message: "Logged out" });
}

async function logoutAll(req, res) {
  const revokedCount = await authService.revokeAllSessions(req.user.id);
  clearRefreshCookie(res);

  res.status(200).json({
    success: true,
    message: `Logged out of ${revokedCount} session(s)`,
    data: { revokedCount },
  });
}

async function me(req, res) {
  const user = await authService.getUserById(req.user.id);

  if (!user || !user.active) {
    throw httpError(401, "Unauthorized");
  }

  res.status(200).json({ success: true, data: authService.toSafeUser(user) });
}

module.exports = {
  login,
  verifyEmail,
  resendOtp,
  refresh,
  logout,
  logoutAll,
  me,
};
