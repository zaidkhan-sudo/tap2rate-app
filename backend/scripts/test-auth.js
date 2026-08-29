const assert = require("assert");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.QR_BASE_URL = "http://localhost:5000";
process.env.ACCESS_TOKEN_SECRET = "test-secret-".repeat(4);
process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";

const sentOtps = [];
const emailService = require("../src/services/emailService");
emailService.sendOtpEmail = async (to, otp) => {
  sentOtps.push({ to, otp });
};

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("auth-test");
  const connectDB = require("../src/config/db");
  await connectDB();

  const authService = require("../src/services/authService");

  const app = require("../src/app");
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const auth = `${base}/api/auth`;

  let pass = 0;

  await authService.provisionAdmin({
    email: "admin@example.com",
    password: "super-secret-99",
    username: "admin",
  });

  let r = await fetch(`${auth}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "super-secret-99" }),
  });
  assert.strictEqual(r.status, 403, `unverified login -> 403, got ${r.status}`);
  assert.ok((await r.json()).message.includes("not verified"));
  console.log("PASS unverified account cannot log in (403)");
  pass++;

  r = await fetch(`${auth}/resend-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "who@nowhere.com" }),
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(sentOtps.length, 0);
  r = await fetch(`${auth}/resend-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com" }),
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(sentOtps.length, 1);
  console.log("PASS resend-otp: silent for strangers, real code for pending admin (no enumeration)");
  pass++;

  r = await fetch(`${auth}/verify-email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", otp: "000000" === sentOtps[0].otp ? "111111" : "000000" }),
  });
  assert.strictEqual(r.status, 400);
  r = await fetch(`${auth}/verify-email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", otp: sentOtps[0].otp }),
  });
  assert.strictEqual(r.status, 200);
  console.log("PASS verify-email: wrong code rejected, correct code verifies");
  pass++;

  async function login() {
    return fetch(`${auth}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "super-secret-99" }),
    });
  }

  function extractCookie(res) {
    const raw = res.headers.getSetCookie().find((c) => c.startsWith("qr_admin_refresh="));
    assert.ok(raw, "refresh cookie must be set");
    return raw;
  }
  function cookieValue(raw) {
    return raw.split(";")[0].split("=")[1];
  }

  r = await fetch(`${auth}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "nobody@x.com", password: "whatever-pass" }),
  });
  const strangerBody = await r.json();
  r = await login();
  assert.strictEqual(r.status, 200);
  const cookieHeader1 = extractCookie(r);
  assert.ok(/httponly/i.test(cookieHeader1));
  assert.ok(/samesite=strict/i.test(cookieHeader1));
  assert.ok(/path=\/api\/auth/i.test(cookieHeader1));
  const okBody = await r.json();
  const atk1 = okBody.data.accessToken;
  assert.ok(okBody.data.user.email === "admin@example.com");
  assert.strictEqual(okBody.data.user.passwordHash, undefined);
  console.log("PASS login success: safe user payload, HttpOnly+Strict+/api/auth cookie");
  pass++;

  r = await login();
  void r;
  const wrongPwRes = await fetch(`${auth}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "totally-wrong-1" }),
  });
  const wrongPwBody = await wrongPwRes.json();
  assert.strictEqual(wrongPwRes.status, 401);
  assert.deepStrictEqual(wrongPwBody, strangerBody, "responses must be indistinguishable");
  console.log("PASS unknown email vs wrong password -> byte-identical 401 (no enumeration)");
  pass++;

  r = await fetch(`${auth}/me`, { headers: { authorization: `Bearer ${atk1}` } });
  assert.strictEqual(r.status, 200);
  const meBody = (await r.json()).data;
  assert.ok(meBody.id && meBody.role === "admin" && meBody.verified === true);
  assert.strictEqual(meBody.passwordHash, undefined);
  console.log("PASS /auth/me works with access token, returns only safe fields");
  pass++;

  r = await fetch(`${base}/api/qr`, { method: "POST", headers: { authorization: `Bearer ${atk1}` } });
  assert.strictEqual(r.status, 201);
  const createdQr = (await r.json()).data;
  r = await fetch(`${base}/api/qr/${createdQr.qrId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${atk1}` },
    body: JSON.stringify({
      businessName: "Sharma Electronics",
      googleReviewUrl: "https://g.page/r/SharmaAuth/review",
    }),
  });
  assert.strictEqual(r.status, 200);
  console.log("PASS authenticated admin can create + assign QR codes");
  pass++;

  r = await fetch(`${base}/api/qr`, { method: "POST" });
  assert.strictEqual(r.status, 401);
  r = await fetch(`${base}/api/qr`);
  assert.strictEqual(r.status, 401);
  console.log("PASS admin APIs reject unauthenticated requests");
  pass++;

  const expired = jwt.sign(
    { id: okBody.data.user.id, sessionId: "0".repeat(24) },
    process.env.ACCESS_TOKEN_SECRET,
    { algorithm: "HS256", expiresIn: "-10s" }
  );
  r = await fetch(`${base}/api/qr`, { headers: { authorization: `Bearer ${expired}` } });
  assert.strictEqual(r.status, 401);
  console.log("PASS expired access token rejected");
  pass++;

  r = await fetch(`${auth}/refresh`, {
    method: "POST",
    headers: { cookie: cookieHeader1.split(";")[0] },
  });
  assert.strictEqual(r.status, 200);
  const rotBody = await r.json();
  const atk2 = rotBody.data.accessToken;
  const cookieRaw2 = extractCookie(r);
  const c2 = cookieValue(cookieRaw2);
  const c1 = cookieValue(cookieHeader1);
  assert.notStrictEqual(c2, c1, "refresh token must rotate");
  console.log("PASS refresh issues new access token + rotated cookie");
  pass++;

  r = await fetch(`${auth}/refresh`, { method: "POST", headers: { cookie: `qr_admin_refresh=${c1}` } });
  assert.strictEqual(r.status, 401, "old token must be dead");
  r = await fetch(`${base}/api/qr`, { headers: { authorization: `Bearer ${atk2}` } });
  assert.strictEqual(r.status, 401, "reuse detection must kill the whole session");
  r = await fetch(`${auth}/refresh`, { method: "POST", headers: { cookie: `qr_admin_refresh=${c2}` } });
  assert.strictEqual(r.status, 401, "even the newest refresh is dead after theft detection");
  console.log("PASS REUSE DETECTION: old token replay -> session fully revoked, live JWT invalidated");
  pass++;

  const login2 = await login();
  const c3 = cookieValue(extractCookie(login2));
  const atk3 = (await login2.json()).data.accessToken;

  const login3 = await login();
  const c4 = cookieValue(extractCookie(login3));
  const atk4 = (await login3.json()).data.accessToken;

  r = await fetch(`${auth}/logout-all`, {
    method: "POST",
    headers: { authorization: `Bearer ${atk3}`, cookie: `qr_admin_refresh=${c3}` },
  });
  assert.strictEqual(r.status, 200);
  const revokeCount = (await r.json()).data.revokedCount;
  assert.ok(revokeCount >= 2);

  r = await fetch(`${auth}/refresh`, { method: "POST", headers: { cookie: `qr_admin_refresh=${c4}` } });
  assert.strictEqual(r.status, 401);
  r = await fetch(`${auth}/me`, { headers: { authorization: `Bearer ${atk4}` } });
  assert.strictEqual(r.status, 401);
  console.log(`PASS logout-all revoked ${revokeCount} sessions; other device's JWT + cookie both dead`);
  pass++;

  const login4 = await login();
  const c5raw = extractCookie(login4);
  const c5 = cookieValue(c5raw);
  const atk5 = (await login4.json()).data.accessToken;

  r = await fetch(`${auth}/logout`, {
    method: "POST",
    headers: { cookie: `qr_admin_refresh=${c5}` },
  });
  assert.strictEqual(r.status, 200);
  assert.ok(/expires=Thu, 01 Jan 1970/i.test(extractCookie(r)) || r.headers.getSetCookie().some((ck) => /qr_admin_refresh=;/i.test(ck)), "cookie cleared");
  r = await fetch(`${auth}/refresh`, { method: "POST", headers: { cookie: `qr_admin_refresh=${c5}` } });
  assert.strictEqual(r.status, 401);
  r = await fetch(`${base}/api/qr`, { headers: { authorization: `Bearer ${atk5}` } });
  assert.strictEqual(r.status, 401, "logged-out session's JWT must stop working");
  console.log("PASS logout revokes session, clears cookie, invalidates outstanding JWT");
  pass++;

  r = await fetch(`${base}/q/${createdQr.qrId}`, { redirect: "manual" });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get("location"), "https://g.page/r/SharmaAuth/review");
  console.log("PASS PUBLIC QR redirect works with zero authentication (customer flow intact)");
  pass++;

  server.close();
  await mongod.stop();
  console.log(`\nALL ${pass}/14 AUTH TEST GROUPS PASSED`);
  process.exit(0);
}

main().catch(async (err) => {
  console.error("TEST FAILURE:", err.message);
  process.exit(1);
});
