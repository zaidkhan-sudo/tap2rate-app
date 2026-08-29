const bcrypt = require("bcryptjs");

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

async function verifyPassword(plainPassword, passwordHash) {
  if (typeof plainPassword !== "string" || typeof passwordHash !== "string") {
    return false;
  }
  return bcrypt.compare(plainPassword, passwordHash);
}

function validatePassword(plainPassword) {
  if (typeof plainPassword !== "string" || plainPassword.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(plainPassword)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(plainPassword)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/\d/.test(plainPassword)) {
    return "Password must contain at least one number";
  }
  return null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePassword,
  BCRYPT_COST,
};
