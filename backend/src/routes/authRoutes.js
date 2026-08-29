const express = require("express");

const controller = require("../controllers/authController");
const asyncHandler = require("../middleware/asyncHandler");
const requireAuth = require("../middleware/auth");
const { loginLimiter, otpLimiter, refreshLimiter } = require("../middleware/security");

const router = express.Router();

router.post("/login", loginLimiter, asyncHandler(controller.login));
router.post("/verify-email", otpLimiter, asyncHandler(controller.verifyEmail));
router.post("/resend-otp", otpLimiter, asyncHandler(controller.resendOtp));
router.post("/refresh", refreshLimiter, asyncHandler(controller.refresh));
router.post("/logout", asyncHandler(controller.logout));
router.post("/logout-all", requireAuth, asyncHandler(controller.logoutAll));
router.get("/me", requireAuth, asyncHandler(controller.me));

module.exports = router;
