const GOOGLE_DOMAINS = ["g.page", "google.com", "goo.gl"];
const MAX_URL_LENGTH = 2048;
const MAX_BUSINESS_NAME_LENGTH = 200;
const QR_ID_PATTERN = /^[A-Za-z0-9]{6}$/;

function hostnameIsAllowed(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return GOOGLE_DOMAINS.some((domain) => h === domain || h.endsWith("." + domain));
}

function validateGoogleReviewUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    return "Google Review URL is required";
  }

  if (rawUrl.trim().length > MAX_URL_LENGTH) {
    return `Google Review URL must be at most ${MAX_URL_LENGTH} characters`;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return "Google Review URL must be a valid absolute URL";
  }

  if (parsed.protocol !== "https:") {
    return "Google Review URL must use HTTPS";
  }

  if (!hostnameIsAllowed(parsed.hostname)) {
    return "Google Review URL must point to a Google domain, e.g. https://g.page/r/XXXXXXXX/review";
  }

  return null;
}

function validateBusinessName(rawName) {
  if (typeof rawName !== "string" || rawName.trim() === "") {
    return "Business name is required";
  }

  if (rawName.trim().length > MAX_BUSINESS_NAME_LENGTH) {
    return `Business name must be at most ${MAX_BUSINESS_NAME_LENGTH} characters`;
  }

  return null;
}

function isValidQrId(qrId) {
  return typeof qrId === "string" && QR_ID_PATTERN.test(qrId);
}

module.exports = {
  validateGoogleReviewUrl,
  validateBusinessName,
  isValidQrId,
  QR_ID_PATTERN,
};
