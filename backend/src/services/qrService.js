const Qr = require("../models/Qr");
const { QR_STATUSES } = require("../models/Qr");
const { generateQrId } = require("../utils/generateQrId");
const {
  validateGoogleReviewUrl,
  validateBusinessName,
  isValidQrId,
} = require("../utils/validation");

const CREATE_MAX_ATTEMPTS = 5;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const REDIRECT_UNAVAILABLE_MESSAGE = "This QR code is not available";

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function createQr() {
  for (let attempt = 1; attempt <= CREATE_MAX_ATTEMPTS; attempt++) {
    try {
      return await Qr.create({ qrId: generateQrId(), status: "UNUSED" });
    } catch (err) {
      if (err.code === 11000 && attempt < CREATE_MAX_ATTEMPTS) {
        continue;
      }
      throw err;
    }
  }
}

async function getQrByQrId(qrId) {
  if (!isValidQrId(qrId)) {
    throw httpError(400, "Invalid QR ID format");
  }

  return Qr.findOne({ qrId }).select("-__v");
}

async function listQrs({ status, search, page, limit } = {}) {
  const filter = {};

  if (status) {
    if (!QR_STATUSES.includes(status)) {
      throw httpError(400, `Status must be one of: ${QR_STATUSES.join(", ")}`);
    }
    filter.status = status;
  }

  if (search && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    filter.$or = [{ businessName: rx }, { qrId: rx }];
  }

  const limitNum = Math.min(
    Math.max(Math.trunc(Number(limit)) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );
  const pageNum = Math.max(Math.trunc(Number(page)) || 1, 1);

  const [items, total] = await Promise.all([
    Qr.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select("-__v"),
    Qr.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum),
  };
}

async function assignQr(qrId, { businessName, googleReviewUrl } = {}) {
  if (!isValidQrId(qrId)) {
    throw httpError(400, "Invalid QR ID format");
  }

  const qr = await Qr.findOne({ qrId });
  if (!qr) {
    throw httpError(404, "QR code not found");
  }

  if (qr.status === "DISABLED") {
    throw httpError(409, "QR code is disabled. Re-enable it before making changes.");
  }

  const nextName = businessName !== undefined ? businessName : qr.businessName;
  const nextUrl = googleReviewUrl !== undefined ? googleReviewUrl : qr.googleReviewUrl;

  const nameError = validateBusinessName(nextName);
  if (nameError) {
    throw httpError(400, nameError);
  }

  const urlError = validateGoogleReviewUrl(nextUrl);
  if (urlError) {
    throw httpError(400, urlError);
  }

  qr.businessName = nextName.trim();
  qr.googleReviewUrl = nextUrl.trim();

  if (qr.status === "UNUSED") {
    qr.status = "ACTIVE";
    qr.assignedAt = new Date();
  }

  await qr.save();
  return qr;
}

async function setQrStatus(qrId, status) {
  if (!isValidQrId(qrId)) {
    throw httpError(400, "Invalid QR ID format");
  }

  if (!QR_STATUSES.includes(status)) {
    throw httpError(400, `Status must be one of: ${QR_STATUSES.join(", ")}`);
  }

  const qr = await Qr.findOne({ qrId });
  if (!qr) {
    throw httpError(404, "QR code not found");
  }

  if (status === qr.status) {
    return qr;
  }

  if (status === "ACTIVE" && !qr.googleReviewUrl) {
    throw httpError(409, "Assign a Google Review URL before activating this QR code");
  }

  qr.status = status;
  await qr.save();
  return qr;
}

async function resolveRedirect(qrId) {
  if (!isValidQrId(qrId)) {
    throw httpError(404, REDIRECT_UNAVAILABLE_MESSAGE);
  }

  const qr = await Qr.findOne({ qrId }).select("googleReviewUrl status");

  if (!qr || qr.status !== "ACTIVE" || !qr.googleReviewUrl) {
    throw httpError(404, REDIRECT_UNAVAILABLE_MESSAGE);
  }

  return qr.googleReviewUrl;
}

async function deleteQr(qrId) {
  if (!isValidQrId(qrId)) {
    throw httpError(400, "Invalid QR ID format");
  }

  const result = await Qr.deleteOne({ qrId });
  if (result.deletedCount === 0) {
    throw httpError(404, "QR code not found");
  }
}

async function getStats() {
  const result = await Qr.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const stats = {
    TOTAL: 0,
    ACTIVE: 0,
    UNUSED: 0,
    DISABLED: 0,
  };

  result.forEach((doc) => {
    if (stats[doc._id] !== undefined) {
      stats[doc._id] = doc.count;
    }
    stats.TOTAL += doc.count;
  });

  return stats;
}

module.exports = {
  createQr,
  getQrByQrId,
  listQrs,
  assignQr,
  setQrStatus,
  resolveRedirect,
  deleteQr,
  getStats,
  httpError,
};
