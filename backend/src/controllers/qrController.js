const qrService = require("../services/qrService");
const { env } = require("../config/env");
const qrcode = require("qrcode");
const { ZipArchive } = require("archiver");

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

async function bulkCreateQrs(req, res) {
  requireJsonObject(req.body);
  const quantity = Number(req.body.quantity);

  // 1. Database operation first. Completes and verifies before sending ZIP.
  const generatedQrs = await qrService.createBulkQrs(quantity);

  // 2. Set up ZIP response
  const dateStr = new Date().toISOString().split("T")[0];
  res.attachment(`tap2rate-qrs-${dateStr}.zip`);

  const archive = new ZipArchive({
    zlib: { level: 9 }, // maximum compression
  });

  archive.on("warning", function (err) {
    if (err.code === "ENOENT") {
      console.warn("Archiver warning:", err);
    } else {
      throw err;
    }
  });

  archive.on("error", function (err) {
    console.error("Archiver error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Failed to create ZIP archive" });
    } else {
      res.end();
    }
  });

  archive.pipe(res);

  // 3. Generate SVGs and append
  const padLength = String(generatedQrs.length).length;

  for (let i = 0; i < generatedQrs.length; i++) {
    const qr = generatedQrs[i];
    const indexStr = String(i + 1).padStart(Math.max(3, padLength), "0");
    const filename = `QR-${indexStr}_${qr.qrId}.svg`;
    const qrUrl = buildQrUrl(qr.qrId);

    const svgString = await qrcode.toString(qrUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 4,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    archive.append(svgString, { name: filename });
  }

  // 4. Finalize
  await archive.finalize();
}

async function bulkDeleteQrs(req, res) {
  requireJsonObject(req.body);

  if (!Array.isArray(req.body.qrIds)) {
    throw qrService.httpError(400, "qrIds must be an array");
  }

  const deletedCount = await qrService.deleteBulkUnusedQrs(req.body.qrIds);

  res.status(200).json({ success: true, data: { deletedCount } });
}

module.exports = {
  createQr,
  listQrs,
  getQr,
  assignQr,
  setQrStatus,
  deleteQr,
  getStats,
  bulkCreateQrs,
  bulkDeleteQrs,
};
