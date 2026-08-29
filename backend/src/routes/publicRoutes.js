const express = require("express");

const qrService = require("../services/qrService");
const { env } = require("../config/env");

const router = express.Router();

const UNAVAILABLE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QR unavailable</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f6f7;color:#333}
.card{background:#fff;padding:2rem 2.5rem;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);text-align:center;max-width:22rem}
h1{font-size:1.1rem;margin:0 0 .5rem}
p{margin:0;font-size:.9rem;color:#777}
</style>
</head>
<body>
<div class="card">
<h1>This QR code is not available</h1>
<p>Please contact the business directly.</p>
</div>
</body>
</html>`;

router.get("/q/:qrId", async (req, res, next) => {
  let result;

  try {
    result = await qrService.resolveRedirect(req.params.qrId);
  } catch (err) {
    if (err && err.statusCode === 404) {
      return res.status(404).type("html").send(UNAVAILABLE_PAGE);
    }
    return next(err);
  }

  res.set("Cache-Control", "no-store");

  if (result.type === "review") {
    return res.redirect(302, result.url);
  }

  // UNUSED QR — redirect to admin assign page
  const adminUrl = env.adminFrontendUrl || env.qrBaseUrl;
  return res.redirect(302, `${adminUrl}/qrs/${result.qrId}`);
});

module.exports = router;

