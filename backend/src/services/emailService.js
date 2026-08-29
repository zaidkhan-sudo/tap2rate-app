const nodemailer = require("nodemailer");

const cached = (global.gmailTransporter = global.gmailTransporter || {
  transporter: null,
});

function getEmailConfig() {
  const user = process.env.GOOGLE_USER;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!user || !clientId || !clientSecret || !refreshToken) {
    const err = new Error("Email service is not configured");
    err.statusCode = 503;
    throw err;
  }

  return { user, clientId, clientSecret, refreshToken };
}

function getTransporter() {
  if (cached.transporter) {
    return cached.transporter;
  }

  const config = getEmailConfig();

  cached.transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: config.user,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
    },
  });

  return cached.transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const config = getEmailConfig();

  return getTransporter().sendMail({
    from: `QR Admin <${config.user}>`,
    to,
    subject,
    text,
    html,
  });
}

function buildOtpHtml(otp, ttlMinutes) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f5f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#ffffff;border-radius:12px;padding:32px;text-align:center;">
<tr><td><h1 style="margin:0 0 8px;font-size:18px;color:#222;">Your verification code</h1></td></tr>
<tr><td style="padding:16px 0;"><div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#111;">${otp}</div></td></tr>
<tr><td style="font-size:14px;color:#666;line-height:1.6;">This code expires in ${ttlMinutes} minutes.<br>If you did not request this code, you can safely ignore this email.</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

function buildOtpText(otp, ttlMinutes) {
  return `Your verification code: ${otp}\n\nThis code expires in ${ttlMinutes} minutes.\nIf you did not request this code, you can safely ignore this email.`;
}

async function sendOtpEmail(to, otp, ttlMinutes = 10) {
  return sendEmail({
    to,
    subject: "Your verification code",
    text: buildOtpText(otp, ttlMinutes),
    html: buildOtpHtml(otp, ttlMinutes),
  });
}

module.exports = { sendEmail, sendOtpEmail };
