const crypto = require("crypto");

const Otp = require("../models/Otp");
const { OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES, OTP_PURPOSES } = require("../models/Otp");
const { sendOtpEmail } = require("./emailService");

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeEmail(rawEmail) {
  return typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
}

function isValidEmailFormat(rawEmail) {
  return EMAIL_PATTERN.test(normalizeEmail(rawEmail));
}

function isValidOtpFormat(rawOtp) {
  return typeof rawOtp === "string" && /^\d{6}$/.test(rawOtp);
}

function generateOtpCode() {
  const limit = 250;
  let otp = "";

  while (otp.length < OTP_LENGTH) {
    const bytes = crypto.randomBytes(OTP_LENGTH);
    for (let i = 0; i < bytes.length && otp.length < OTP_LENGTH; i++) {
      if (bytes[i] < limit) {
        otp += String(bytes[i] % 10);
      }
    }
  }

  return otp;
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function hashesMatch(a, b) {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

async function issueOtp(rawEmail, purpose = OTP_PURPOSES[0]) {
  const email = normalizeEmail(rawEmail);

  if (!isValidEmailFormat(email)) {
    throw httpError(400, "A valid email address is required");
  }

  const existing = await Otp.findOne({ email, purpose });

  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw httpError(429, "Please wait a minute before requesting another code");
  }

  await Otp.deleteMany({ email, purpose });

  const otp = generateOtpCode();

  await Otp.create({
    email,
    purpose,
    otpHash: hashOtp(otp),
    attempts: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
  });

  await sendOtpEmail(email, otp, OTP_TTL_MINUTES);
}

async function verifyOtp(rawEmail, rawOtp, purpose = OTP_PURPOSES[0]) {
  const email = normalizeEmail(rawEmail);

  if (!isValidEmailFormat(email)) {
    throw httpError(400, "A valid email address is required");
  }

  if (!isValidOtpFormat(rawOtp)) {
    throw httpError(400, "Invalid verification code");
  }

  const record = await Otp.findOne({ email, purpose });

  if (!record || record.expiresAt.getTime() <= Date.now()) {
    if (record) {
      await record.deleteOne();
    }
    throw httpError(400, "Invalid or expired verification code");
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await record.deleteOne();
    throw httpError(400, "Too many incorrect attempts. Please request a new code.");
  }

  if (!hashesMatch(hashOtp(rawOtp), record.otpHash)) {
    record.attempts += 1;
    await record.save();

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await record.deleteOne();
    }

    throw httpError(400, "Invalid verification code");
  }

  await record.deleteOne();
  return true;
}

module.exports = {
  issueOtp,
  verifyOtp,
  isValidEmailFormat,
  isValidOtpFormat,
};
