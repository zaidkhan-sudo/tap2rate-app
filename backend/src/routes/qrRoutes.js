const express = require("express");

const controller = require("../controllers/qrController");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.post("/", asyncHandler(controller.createQr));
router.post("/bulk", asyncHandler(controller.bulkCreateQrs));
router.get("/", asyncHandler(controller.listQrs));
router.get("/stats", asyncHandler(controller.getStats));
router.get("/:qrId", asyncHandler(controller.getQr));
router.patch("/:qrId", asyncHandler(controller.assignQr));
router.patch("/:qrId/status", asyncHandler(controller.setQrStatus));
router.delete("/bulk", asyncHandler(controller.bulkDeleteQrs));
router.delete("/:qrId", asyncHandler(controller.deleteQr));

module.exports = router;
