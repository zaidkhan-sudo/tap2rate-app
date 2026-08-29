const mongoose = require("mongoose");

const RETIRED_TOKEN_LIMIT = 5;

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    retiredTokenHashes: {
      type: [String],
      default: [],
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    ip: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
      maxlength: 500,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

sessionSchema.index({ userId: 1, revoked: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Session", sessionSchema);
module.exports.RETIRED_TOKEN_LIMIT = RETIRED_TOKEN_LIMIT;
