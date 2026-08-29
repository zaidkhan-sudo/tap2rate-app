const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.QR_BASE_URL = "https://qr.example.com";
process.env.ACCESS_TOKEN_SECRET = "api-suite-secret-".repeat(3);

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("qr-api-test");

  const connectDB = require("../src/config/db");
  await connectDB();

  const authService = require("../src/services/authService");
  const User = require("../src/models/User");
  await authService.provisionAdmin({
    email: "tester@example.com",
    password: "password-123",
    username: "tester",
  });
  await User.updateOne({ email: "tester@example.com" }, { $set: { verified: true } });
  const session = await authService.login("tester@example.com", "password-123", "127.0.0.1", "suite");
  const bearer = session.accessToken;

  const app = require("../src/app");
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const api = `${base}/api/qr`;
  const auth = (extra = {}) => ({ authorization: `Bearer ${bearer}`, ...extra });

  let pass = 0;

  let res = await fetch(api, { method: "POST", headers: auth() });
  assert.strictEqual(res.status, 201);
  const created = (await res.json()).data;
  assert.match(created.qrUrl, /^https:\/\/qr\.example\.com\/q\/[A-Za-z0-9]{6}$/);
  const qrId = created.qrId;
  console.log(`PASS POST /api/qr -> 201, ${created.qrUrl}`);
  pass++;

  res = await fetch(api, { headers: auth() });
  assert.strictEqual((await res.json()).data.total, 1);
  res = await fetch(`${api}?status=UNUSED`, { headers: auth() });
  assert.strictEqual((await res.json()).data.total, 1);
  res = await fetch(`${api}?status=BOGUS`, { headers: auth() });
  assert.strictEqual(res.status, 400);
  res = await fetch(`${api}?search=${qrId.toLowerCase()}`, { headers: auth() });
  assert.strictEqual((await res.json()).data.total, 1);
  console.log("PASS GET /api/qr -> list, status filter, invalid status 400, search by id");
  pass++;

  res = await fetch(`${api}/${qrId}`, { headers: auth() });
  assert.strictEqual(res.status, 200);
  res = await fetch(`${api}/ZZZZZZ`, { headers: auth() });
  assert.strictEqual(res.status, 404);
  console.log("PASS GET /api/qr/:id -> 200 / unknown -> 404 JSON");
  pass++;

  res = await fetch(`${api}/${qrId}`, {
    method: "PATCH",
    headers: auth({ "content-type": "application/json" }),
    body: JSON.stringify({ businessName: "Sharma Electronics", googleReviewUrl: "http://insecure.example.com" }),
  });
  assert.strictEqual(res.status, 400);
  res = await fetch(`${api}/${qrId}`, {
    method: "PATCH",
    headers: auth({ "content-type": "application/json" }),
    body: JSON.stringify({ businessName: "Sharma Electronics", googleReviewUrl: "https://g.page/r/E2ETest/review" }),
  });
  assert.strictEqual(res.status, 200);
  const assigned = (await res.json()).data;
  assert.strictEqual(assigned.status, "ACTIVE");
  assert.ok(assigned.assignedAt);
  console.log("PASS PATCH assign -> rejects bad URL (400), activates with valid URL (200)");
  pass++;

  res = await fetch(`${api}/${qrId}/status`, {
    method: "PATCH",
    headers: auth({ "content-type": "application/json" }),
    body: JSON.stringify({ status: "DISABLED" }),
  });
  assert.strictEqual(res.status, 200);
  res = await fetch(`${api}/${qrId}`, {
    method: "PATCH",
    headers: auth({ "content-type": "application/json" }),
    body: JSON.stringify({ googleReviewUrl: "https://g.page/r/New/review" }),
  });
  assert.strictEqual(res.status, 409);
  res = await fetch(`${api}/${qrId}/status`, {
    method: "PATCH",
    headers: auth({ "content-type": "application/json" }),
    body: JSON.stringify({ status: "WEIRD" }),
  });
  assert.strictEqual(res.status, 400);
  res = await fetch(`${api}/${qrId}/status`, {
    method: "PATCH",
    headers: auth({ "content-type": "application/json" }),
    body: JSON.stringify({ status: "ACTIVE" }),
  });
  assert.strictEqual(res.status, 200);
  console.log("PASS PATCH status -> disable, edit-blocked 409, bad status 400, re-activate");
  pass++;

  res = await fetch(`${api}/${qrId}`, {
    method: "PATCH",
    headers: auth({ "content-type": "application/json" }),
    body: "{oops-not-json",
  });
  assert.strictEqual(res.status, 400, `malformed JSON should be 400, got ${res.status}`);
  const errBody = await res.json();
  assert.strictEqual(errBody.success, false);
  res = await fetch(`${base}/api/does-not-exist`);
  assert.strictEqual(res.status, 404);
  console.log("PASS malformed JSON body -> clean 400 (not 500); unknown API path -> 404");
  pass++;

  server.close();
  await mongod.stop();
  console.log(`\nALL ${pass}/6 HTTP TEST GROUPS PASSED`);
  process.exit(0);
}

main().catch((err) => {
  console.error("TEST FAILURE:", err.message);
  process.exit(1);
});
