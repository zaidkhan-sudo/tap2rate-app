const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.QR_BASE_URL = "https://qr.example.com";

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("qr-redirect-test");

  const connectDB = require("../src/config/db");
  await connectDB();

  const qrService = require("../src/services/qrService");

  const app = require("../src/app");
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  let pass = 0;

  const active = await qrService.createQr();
  await qrService.assignQr(active.qrId, {
    businessName: "Sharma Electronics",
    googleReviewUrl: "https://g.page/r/SharmaE2E/review",
  });

  let res = await fetch(`${base}/q/${active.qrId}`, { redirect: "manual" });
  assert.strictEqual(res.status, 302, `expected 302, got ${res.status}`);
  assert.strictEqual(res.headers.get("location"), "https://g.page/r/SharmaE2E/review");
  assert.strictEqual(res.headers.get("cache-control"), "no-store");
  console.log(`PASS GET /q/${active.qrId} -> 302 -> ${res.headers.get("location")} (no-store cache)`);
  pass++;

  res = await fetch(`${base}/q/${active.qrId}`, { redirect: "follow" });
  assert.ok(res.url.startsWith("https://www.google.com"), `expected to land on Google, got ${res.url}`);
  console.log("PASS full customer journey: scan URL -> our 302 -> lands on Google");
  pass++;

  for (const [label, path] of [
    ["unknown QR", "/q/ZZZZZZ"],
    ["malformed ID (traversal)", "/q/..%2F..%2Fetc"],
    ["wrong length ID", "/q/X91mQ"],
  ]) {
    res = await fetch(`${base}${path}`, { redirect: "manual" });
    assert.strictEqual(res.status, 404, `${label}: expected 404, got ${res.status}`);
    const html = await res.text();
    assert.ok(html.includes("This QR code is not available"));
    assert.strictEqual(res.headers.get("content-type").includes("text/html"), true);
  }
  console.log("PASS unknown/malformed IDs -> friendly HTML 404, uniform message");
  pass++;

  const unused = await qrService.createQr();
  res = await fetch(`${base}/q/${unused.qrId}`, { redirect: "manual" });
  assert.strictEqual(res.status, 404);
  assert.ok((await res.text()).includes("not available"));

  await qrService.setQrStatus(active.qrId, "DISABLED");
  res = await fetch(`${base}/q/${active.qrId}`, { redirect: "manual" });
  assert.strictEqual(res.status, 404, "disabled must NOT redirect");
  assert.ok((await res.text()).includes("not available"));

  await qrService.setQrStatus(active.qrId, "ACTIVE");
  res = await fetch(`${base}/q/${active.qrId}`, { redirect: "manual" });
  assert.strictEqual(res.status, 302);
  console.log("PASS UNUSED and DISABLED -> no redirect (HTML 404); re-activate restores 302");
  pass++;

  await qrService.assignQr(active.qrId, { googleReviewUrl: "https://g.page/r/Updated/review" });
  res = await fetch(`${base}/q/${active.qrId}`, { redirect: "manual" });
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.headers.get("location"), "https://g.page/r/Updated/review");
  console.log("PASS dynamic update: same physical QR now redirects to new destination");
  pass++;

  server.close();
  await mongod.stop();
  console.log(`\nALL ${pass}/5 REDIRECT TEST GROUPS PASSED`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("TEST FAILURE:", err.message);
    process.exit(1);
  });
