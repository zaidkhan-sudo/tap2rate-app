const mongoose = require("mongoose");

const QR_STATUSES = ["UNUSED", "ACTIVE", "DISABLED"];

const qrSchema = new mongoose.Schema(
  {
    qrId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    businessName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    googleReviewUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
    },
    googlePlaceId: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: QR_STATUSES,
      default: "UNUSED",
      index: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Qr", qrSchema);
module.exports.QR_STATUSES = QR_STATUSES;
