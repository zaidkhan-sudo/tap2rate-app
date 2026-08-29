const asyncHandler = require("./asyncHandler");
const authService = require("../services/authService");
const { verifyAccessToken } = require("../utils/tokens");

function unauthorized() {
  const err = new Error("Unauthorized");
  err.statusCode = 401;
  return err;
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    throw unauthorized();
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw unauthorized();
  }

  const { userId, sessionId } = verifyAccessToken(token);

  const session = await authService.getValidSession(userId, sessionId);
  if (!session) {
    throw unauthorized();
  }

  req.user = { id: userId, sessionId };
  next();
}

module.exports = asyncHandler(requireAuth);
