const crypto = require("crypto");

const User = require("../models/User");
const Session = require("../models/Session");
const { RETIRED_TOKEN_LIMIT } = require("../models/Session");
const {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  parseDurationMs,
} = require("../utils/tokens");
const { hashPassword, verifyPassword } = require("../utils/passwords");
const { env } = require("../config/env");

const GENERIC_CREDENTIALS_MESSAGE = "Invalid email or password";
const SESSION_REVOKED_MESSAGE = "Your session has been revoked. Please log in again.";
const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function toSafeUser(user) {
  return {
    id: user._id.toString(),
    username: user.username || "",
    email: user.email,
    role: user.role,
    verified: user.verified,
    active: user.active,
  };
}

async function provisionAdmin({ email, password, username }) {
  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { username: (username || "").trim().toLowerCase() }],
  });

  if (existing) {
    throw httpError(409, "An admin account with this email or username already exists");
  }

  const passwordError =
    typeof password === "string" && password.length >= 8
      ? null
      : "Password must be at least 8 characters";

  if (passwordError) {
    throw httpError(400, passwordError);
  }

  const passwordHash = await hashPassword(password);

  return User.create({
    email: normalizedEmail,
    username: (username || "").trim().toLowerCase(),
    passwordHash,
    role: "admin",
    active: true,
    verified: false,
  });
}

let dummyHashPromise = null;

function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(crypto.randomUUID());
  }
  return dummyHashPromise;
}

async function login(rawEmail, rawPassword, ip, userAgent) {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  const user = email
    ? await User.findOne({ email }).select("+passwordHash")
    : null;

  // Account lockout check
  if (user && user.lockUntil && user.lockUntil > new Date()) {
    throw httpError(423, "Account temporarily locked due to too many failed attempts. Try again later.");
  }

  const passwordMatches = user
    ? await verifyPassword(password, user.passwordHash)
    : await getDummyHash().then((dummy) => verifyPassword(password, dummy));

  if (!user || !passwordMatches) {
    // Increment failed attempts on the real user
    if (user) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      }
      await user.save();
    }
    throw httpError(401, GENERIC_CREDENTIALS_MESSAGE);
  }

  if (!user.active) {
    throw httpError(403, "This account has been disabled");
  }

  if (!user.verified) {
    throw httpError(403, "Email not verified. Please verify your email before logging in.");
  }

  // Reset failed attempts on successful login
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }

  const session = await createSession(user._id.toString(), ip, userAgent);

  return {
    accessToken: signAccessToken({ id: user._id.toString(), sessionId: session._id.toString() }),
    refreshToken: session.refreshToken,
    sessionId: session._id.toString(),
    user: toSafeUser(user),
  };
}

async function createSession(userId, ip, userAgent) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + parseDurationMs(env.refreshTokenExpiresIn));

  const session = await Session.create({
    userId,
    refreshTokenHash,
    ip: ip || "",
    userAgent: (userAgent || "").slice(0, 500),
    expiresAt,
  });

  return { _id: session._id, refreshToken };
}

async function findSessionByAnyToken(tokenHash) {
  const current = await Session.findOne({ refreshTokenHash: tokenHash });
  if (current) {
    return { session: current, reused: false };
  }

  const retired = await Session.findOne({ retiredTokenHashes: tokenHash });
  if (retired) {
    return { session: retired, reused: true };
  }

  return { session: null, reused: false };
}

async function rotateSession(rawToken, ip, userAgent) {
  if (typeof rawToken !== "string" || !rawToken) {
    throw httpError(401, "Missing session token");
  }

  const tokenHash = hashToken(rawToken);
  const { session, reused } = await findSessionByAnyToken(tokenHash);

  if (!session) {
    throw httpError(401, "Invalid session");
  }

  if (reused || session.revoked) {
    session.revoked = true;
    await session.save();
    throw httpError(401, SESSION_REVOKED_MESSAGE);
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    session.revoked = true;
    await session.save();
    throw httpError(401, "Session expired. Please log in again.");
  }

  const nextToken = generateRefreshToken();
  const nextHash = hashToken(nextToken);

  session.retiredTokenHashes = [...session.retiredTokenHashes, tokenHash].slice(-RETIRED_TOKEN_LIMIT);
  session.refreshTokenHash = nextHash;
  session.expiresAt = new Date(Date.now() + parseDurationMs(env.refreshTokenExpiresIn));
  session.lastUsedAt = new Date();
  session.ip = ip || session.ip;
  session.userAgent = ((userAgent || "") + "").slice(0, 500) || session.userAgent;

  await session.save();

  return {
    accessToken: signAccessToken({
      id: session.userId.toString(),
      sessionId: session._id.toString(),
    }),
    refreshToken: nextToken,
    userId: session.userId.toString(),
  };
}

async function revokeSessionByToken(rawToken) {
  if (typeof rawToken !== "string" || !rawToken) {
    return false;
  }

  const session = await Session.findOne({ refreshTokenHash: hashToken(rawToken) });
  if (!session || session.revoked) {
    return false;
  }

  session.revoked = true;
  await session.save();
  return true;
}

async function revokeAllSessions(userId) {
  const result = await Session.updateMany(
    { userId, revoked: false },
    { $set: { revoked: true } }
  );
  return result.modifiedCount || 0;
}

async function getValidSession(userId, sessionId) {
  if (
    typeof userId !== "string" ||
    typeof sessionId !== "string" ||
    !/^[a-f\d]{24}$/i.test(sessionId)
  ) {
    return null;
  }

  let session;
  try {
    session = await Session.findById(sessionId);
  } catch {
    return null;
  }

  if (!session || session.revoked) {
    return null;
  }

  if (session.userId.toString() !== userId) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return session;
}

async function getUserById(id) {
  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)) {
    return null;
  }
  return User.findById(id);
}

module.exports = {
  provisionAdmin,
  login,
  rotateSession,
  revokeSessionByToken,
  revokeAllSessions,
  getValidSession,
  getUserById,
  toSafeUser,
};
