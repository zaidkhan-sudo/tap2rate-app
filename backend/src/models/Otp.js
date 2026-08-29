const mongoose = require("mongoose");

const OTP_PURPOSES = ["EMAIL_VERIFICATION"];
const OTP_MAX_ATTEMPTS = 5;
const OTP_TTL_MINUTES = 10;

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: OTP_PURPOSES,
      default: "EMAIL_VERIFICATION",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model("Otp", otpSchema);
module.exports.OTP_PURPOSES = OTP_PURPOSES;
module.exports.OTP_MAX_ATTEMPTS = OTP_MAX_ATTEMPTS;
module.exports.OTP_TTL_MINUTES = OTP_TTL_MINUTES;
