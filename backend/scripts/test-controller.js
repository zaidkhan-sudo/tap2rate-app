const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");

const connectDB = require("../src/config/db");
const qrService = require("../src/services/qrService");
process.env.QR_BASE_URL = "https://qr.example.com";
const controller = require("../src/controllers/qrController");

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("qr-test");
  await connectDB();

  let pass = 0;

  const res1 = mockRes();
  await controller.createQr({}, res1);
  assert.strictEqual(res1.statusCode, 201);
  assert.strictEqual(res1.body.success, true);
  const qrId = res1.body.data.qrUrl.match(/\/q\/([A-Za-z0-9]{6})$/)[1];
  assert.strictEqual(res1.body.data.qrUrl, `https://qr.example.com/q/${qrId}`);
  assert.strictEqual(res1.body.data.status, "UNUSED");
  console.log(`PASS create -> 201, payload includes qrUrl ${res1.body.data.qrUrl}`);
  pass++;

  await controller.assignQr(
    { params: { qrId }, body: { businessName: "Sharma Electronics", googleReviewUrl: "https://g.page/r/Test/review" } },
    mockRes()
  );

  const res2 = mockRes();
  await controller.getQr({ params: { qrId } }, res2);
  assert.strictEqual(res2.statusCode, 200);
  assert.strictEqual(res2.body.data.businessName, "Sharma Electronics");
  assert.strictEqual(res2.body.data.googleReviewUrl, "https://g.page/r/Test/review");
  console.log("PASS get -> 200 with full payload");
  pass++;

  let caught;
  try {
    await controller.getQr({ params: { qrId: "ZZZZZZ" } }, mockRes());
  } catch (err) {
    caught = err;
  }
  assert.strictEqual(caught.statusCode, 404);
  console.log("PASS get unknown -> throws 404 for central handler");
  pass++;

  const res3 = mockRes();
  await controller.listQrs({ query: { status: "ACTIVE", search: "sharma" } }, res3);
  assert.strictEqual(res3.statusCode, 200);
  assert.strictEqual(res3.body.data.total, 1);
  assert.strictEqual(res3.body.data.items[0].qrUrl.startsWith("https://qr.example.com/q/"), true);
  console.log("PASS list -> filters + per-item qrUrl");
  pass++;

  caught = undefined;
  try {
    await controller.assignQr({ params: { qrId }, body: "not-an-object" }, mockRes());
  } catch (err) {
    caught = err;
  }
  assert.strictEqual(caught.statusCode, 400);
  try {
    await controller.setQrStatus({ params: { qrId }, body: {} }, mockRes());
  } catch (err) {
    caught = err;
  }
  assert.strictEqual(caught.statusCode, 400);
  console.log("PASS malformed bodies -> 400 before service call");
  pass++;

  const res4 = mockRes();
  await controller.setQrStatus({ params: { qrId }, body: { status: "DISABLED" } }, res4);
  assert.strictEqual(res4.body.data.status, "DISABLED");

  caught = undefined;
  try {
    await controller.assignQr({ params: { qrId }, body: { googleReviewUrl: "https://g.page/r/x/review" } }, mockRes());
  } catch (err) {
    caught = err;
  }
  assert.strictEqual(caught.statusCode, 409);
  console.log("PASS disable via controller; edit-while-disabled surfaces service 409");
  pass++;

  await mongod.stop();
  console.log(`\nALL ${pass}/6 CONTROLLER TEST GROUPS PASSED`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("TEST FAILURE:", err.message);
    process.exit(1);
  });
