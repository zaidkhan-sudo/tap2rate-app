const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");

const connectDB = require("../src/config/db");
const qrService = require("../src/services/qrService");

async function expectHttpError(fn, statusCode, label) {
  try {
    await fn();
    throw new Error(`${label}: expected error but none thrown`);
  } catch (err) {
    assert.strictEqual(err.statusCode, statusCode, `${label}: expected ${statusCode}, got ${err.statusCode} (${err.message})`);
  }
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("qr-test");

  await connectDB();

  let pass = 0;

  const q1 = await qrService.createQr();
  const q2 = await qrService.createQr();
  const q3 = await qrService.createQr();
  assert.match(q1.qrId, /^[A-Za-z0-9]{6}$/);
  assert.strictEqual(q1.status, "UNUSED");
  assert.strictEqual(q1.assignedAt, null);
  assert.ok(new Set([q1.qrId, q2.qrId, q3.qrId]).size === 3);
  console.log(`PASS create: unique IDs (${q1.qrId}, ${q2.qrId}, ${q3.qrId}), status UNUSED`);
  pass++;

  let list = await qrService.listQrs({});
  assert.strictEqual(list.total, 3);
  list = await qrService.listQrs({ status: "UNUSED" });
  assert.strictEqual(list.total, 3);
  await expectHttpError(() => qrService.listQrs({ status: "BOGUS" }), 400, "bad status filter");
  console.log("PASS list + status filter validation");
  pass++;

  const url = "https://g.page/r/SharmaTest123/review";
  const assigned = await qrService.assignQr(q1.qrId, {
    businessName: "Sharma Electronics",
    googleReviewUrl: url,
  });
  assert.strictEqual(assigned.status, "ACTIVE");
  assert.ok(assigned.assignedAt instanceof Date);
  assert.strictEqual(assigned.googleReviewUrl, url);
  console.log("PASS assign: UNUSED -> ACTIVE, businessName + URL saved, assignedAt set");
  pass++;

  const edited = await qrService.assignQr(q1.qrId, {
    googleReviewUrl: "https://g.page/r/NewUrl456/review",
  });
  assert.strictEqual(edited.businessName, "Sharma Electronics");
  assert.strictEqual(edited.googleReviewUrl, "https://g.page/r/NewUrl456/review");
  console.log("PASS assign on ACTIVE QR = partial edit (URL changed, name kept)");
  pass++;

  await expectHttpError(
    () => qrService.assignQr(q2.qrId, { businessName: "X", googleReviewUrl: "http://g.page/r/x/review" }),
    400,
    "non-https URL rejected"
  );
  await expectHttpError(
    () => qrService.assignQr(q2.qrId, { businessName: "", googleReviewUrl: url }),
    400,
    "empty name rejected"
  );
  await expectHttpError(() => qrService.assignQr("ZZZZZZ", { businessName: "X", googleReviewUrl: url }), 404, "assign unknown QR");
  console.log("PASS assign validation: bad URL / empty name / unknown ID -> 400/404");
  pass++;

  const activeResult = await qrService.resolveRedirect(q1.qrId);
  assert.deepStrictEqual(activeResult, { type: "review", url: "https://g.page/r/NewUrl456/review" });
  console.log("PASS redirect resolution returns { type: 'review', url } for ACTIVE QR");
  pass++;

  const unusedResult = await qrService.resolveRedirect(q3.qrId);
  assert.strictEqual(unusedResult.type, "unassigned");
  assert.strictEqual(unusedResult.qrId, q3.qrId);
  await expectHttpError(() => qrService.resolveRedirect("NOPE12"), 404, "unknown QR uniform 404");
  console.log("PASS UNUSED QR -> { type: 'unassigned' }; unknown QR -> 404");
  pass++;

  await expectHttpError(
    () => qrService.setQrStatus(q2.qrId, "ACTIVE"),
    409,
    "activate without URL"
  );

  const disabled = await qrService.setQrStatus(q1.qrId, "DISABLED");
  assert.strictEqual(disabled.status, "DISABLED");
  await expectHttpError(() => qrService.resolveRedirect(q1.qrId), 404, "disabled QR no redirect");
  await expectHttpError(
    () => qrService.assignQr(q1.qrId, { googleReviewUrl: "https://g.page/r/x/review" }),
    409,
    "edit while disabled"
  );
  const reactivated = await qrService.setQrStatus(q1.qrId, "ACTIVE");
  assert.strictEqual(reactivated.status, "ACTIVE");
  const reactivatedResult = await qrService.resolveRedirect(q1.qrId);
  assert.deepStrictEqual(reactivatedResult, { type: "review", url: "https://g.page/r/NewUrl456/review" });
  console.log("PASS disable blocks redirect+edits; re-enable restores redirect; premature activation blocked (409)");
  pass++;

  await qrService.assignQr(q2.qrId, { businessName: "Rahul Sweets", googleReviewUrl: "https://g.page/r/Rahul/review" });

  list = await qrService.listQrs({ search: "sharma" });
  assert.strictEqual(list.total, 1);
  assert.strictEqual(list.items[0].businessName, "Sharma Electronics");
  list = await qrService.listQrs({ search: q2.qrId.toLowerCase() });
  assert.strictEqual(list.total, 1);
  list = await qrService.listQrs({ status: "ACTIVE" });
  assert.strictEqual(list.total, 2);
  list = await qrService.listQrs({ page: 1, limit: 2 });
  assert.strictEqual(list.pages, 2);
  assert.strictEqual(list.items.length, 2);
  console.log("PASS search by name/id (case-insensitive) + pagination math");
  pass++;

  await mongod.stop();
  console.log(`\nALL ${pass}/9 SERVICE TEST GROUPS PASSED`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("TEST FAILURE:", err.message);
    process.exit(1);
  });
