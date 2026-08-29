const qrService = require("../services/qrService");
const { env } = require("../config/env");

function buildQrUrl(qrId) {
  return `${env.qrBaseUrl.replace(/\/+$/, "")}/q/${qrId}`;
}

function toQrPayload(qr) {
  return {
    qrId: qr.qrId,
    businessName: qr.businessName ?? null,
    googleReviewUrl: qr.googleReviewUrl ?? null,
    googlePlaceId: qr.googlePlaceId ?? null,
    status: qr.status,
    assignedAt: qr.assignedAt ?? null,
    createdAt: qr.createdAt,
    updatedAt: qr.updatedAt,
    qrUrl: buildQrUrl(qr.qrId),
  };
}

function requireJsonObject(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw qrService.httpError(400, "Request body must be a JSON object");
  }
}

async function createQr(req, res) {
  const qr = await qrService.createQr();
  res.status(201).json({ success: true, data: toQrPayload(qr) });
}

async function listQrs(req, res) {
  const result = await qrService.listQrs({
    status: req.query.status,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit,
  });

  res.status(200).json({
    success: true,
    data: {
      ...result,
      items: result.items.map(toQrPayload),
    },
  });
}

async function getQr(req, res) {
  const qr = await qrService.getQrByQrId(req.params.qrId);

  if (!qr) {
    throw qrService.httpError(404, "QR code not found");
  }

  res.status(200).json({ success: true, data: toQrPayload(qr) });
}

async function assignQr(req, res) {
  requireJsonObject(req.body);

  const qr = await qrService.assignQr(req.params.qrId, {
    businessName: req.body.businessName,
    googleReviewUrl: req.body.googleReviewUrl,
  });

  res.status(200).json({ success: true, data: toQrPayload(qr) });
}

async function setQrStatus(req, res) {
  requireJsonObject(req.body);

  const qr = await qrService.setQrStatus(req.params.qrId, req.body.status);

  res.status(200).json({ success: true, data: toQrPayload(qr) });
}

async function deleteQr(req, res) {
  await qrService.deleteQr(req.params.qrId);
  res.status(200).json({ success: true });
}

async function getStats(req, res) {
  const stats = await qrService.getStats();
  res.status(200).json({ success: true, data: stats });
}

module.exports = {
  createQr,
  listQrs,
  getQr,
  assignQr,
  setQrStatus,
  deleteQr,
  getStats,
};
