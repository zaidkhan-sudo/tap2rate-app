const express = require("express");
const morgan = require("morgan");

const publicRoutes = require("./routes/publicRoutes");
const qrRoutes = require("./routes/qrRoutes");
const authRoutes = require("./routes/authRoutes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const asyncHandler = require("./middleware/asyncHandler");
const requireAuth = require("./middleware/auth");
const {
  helmetMiddleware,
  corsHandler,
  cookieParserMiddleware,
  publicLimiter,
  adminApiLimiter,
} = require("./middleware/security");
const { env } = require("./config/env");

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmetMiddleware);
app.use(morgan(env.isProd ? "combined" : "dev"));
app.use(corsHandler);
app.use(cookieParserMiddleware);
app.use(express.json({ limit: "16kb" }));

app.use("/q", publicLimiter);
app.use(publicRoutes);

app.get(
  "/health",
  asyncHandler(async (req, res) => {
    res.status(200).json({ status: "ok" });
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/qr", requireAuth, adminApiLimiter, qrRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
