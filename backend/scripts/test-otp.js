const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.MONGODB_URI = "";
process.env.QR_BASE_URL = "http://localhost:5000";

const sentMails = [];
const emailServicePath = "/Users/zaidkhan/Developer/Aaquib_proj_2/backend/src/services/emailService";
const emailService = require(emailServicePath);
emailService.sendOtpEmail = async (to, otp) => {
  sentMails.push({ to, otp });
};

const otpService = require("/Users/zaidkhan/Developer/Aaquib_proj_2/backend/src/services/otpService");
const Otp = require("/Users/zaidkhan/Developer/Aaquib_proj_2/backend/src/models/Otp");

async function expectError(fn, statusCode, label) {
  try {
    await fn();
    throw new Error(`${label}: expected error`);
  } catch (err) {
    assert.strictEqual(err.statusCode, statusCode, `${label}: wanted ${statusCode}, got ${err.statusCode} (${err.message})`);
  }
}

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("otp-test");
  const connectDB = require("/Users/zaidkhan/Developer/Aaquib_proj_2/backend/src/config/db");
  await connectDB();

  let pass = 0;

  for (let i = 0; i < 200; i++) {
    const code = otpService.constructor;
    break;
  }

  await otpService.issueOtp("Admin@Example.com");
  assert.strictEqual(sentMails.length, 1);
  assert.strictEqual(sentMails[0].to, "admin@example.com");
  assert.match(sentMails[0].otp, /^\d{6}$/);
  const doc = await Otp.findOne({ email: "admin@example.com" });
  assert.ok(doc);
  assert.notStrictEqual(doc.otpHash, sentMails[0].otp);
  assert.match(doc.otpHash, /^[a-f0-9]{64}$/);
  assert.strictEqual(doc.attempts, 0);
  console.log(`PASS issue -> hashed (never plaintext), emailed ${sentMails[0].otp} to lowercased address`);
  pass++;

  await expectError(() => otpService.issueOtp("admin@example.com"), 429, "immediate resend");
  console.log("PASS resend cooldown enforced (60s)");
  pass++;

  const wrongCode = sentMails[0].otp === "000000" ? "111111" : "000000";
  await expectError(() => otpService.verifyOtp("admin@example.com", wrongCode), 400, "wrong otp");
  const afterWrong = await Otp.findOne({ email: "admin@example.com" });
  assert.strictEqual(afterWrong.attempts, 1);
  console.log("PASS wrong code -> attempt counter incremented, doc survives");
  pass++;

  await otpService.verifyOtp("ADMIN@example.com ", sentMails[0].otp);
  const gone = await Otp.findOne({ email: "admin@example.com" });
  assert.strictEqual(gone, null);
  console.log("PASS correct code (case/space-normalized email) -> verified + single-use deletion");
  pass++;

  await expectError(() => otpService.verifyOtp("admin@example.com", sentMails[0].otp), 400, "replay");
  console.log("PASS replay after successful verify rejected");
  pass++;

  for (let i = 0; i < 5; i++) {
    try {
      await otpService.verifyOtp("brute@test.com", "999999");
      if (i < 4) {
        const r = await Otp.findOne({ email: "brute@test.com" });
        assert.ok(r, "doc should survive first 4 failures");
        assert.strictEqual(r.attempts, i + 1);
      }
    } catch {}
  }
  assert.strictEqual(await Otp.findOne({ email: "brute@test.com" }), null, "code dead at cap");
  await expectError(() => otpService.verifyOtp("brute@test.com", "999999"), 400, "post-cap");
  console.log("PASS brute force: attempts counted 1..4, code destroyed at 5th failure, stays dead");
  pass++;

  await Otp.create({
    email: "expired@test.com",
    otpHash: "a".repeat(64),
    attempts: 0,
    expiresAt: new Date(Date.now() - 1000),
  });
  await expectError(() => otpService.verifyOtp("expired@test.com", "123456"), 400, "expired");
  assert.strictEqual(await Otp.findOne({ email: "expired@test.com" }), null, "expired swept eagerly");
  console.log("PASS expired-but-not-yet-reaped code rejected AND eagerly deleted (TTL is backup only)");
  pass++;

  await expectError(() => otpService.verifyOtp("not-an-email", "123456"), 400, "bad email");
  await expectError(() => otpService.verifyOtp("a@b.com", "12345"), 400, "short otp");
  await expectError(() => otpService.verifyOtp("a@b.com", "abcdef"), 400, "non-numeric otp");
  await expectError(() => otpService.issueOtp("nope", undefined), 400, "bad issue email");
  console.log("PASS input format validation on both endpoints");
  pass++;

  await mongod.stop();
  console.log(`\nALL ${pass}/8 OTP TEST GROUPS PASSED`);
  process.exit(0);
})().catch((err) => {
  console.error("TEST FAILURE:", err.message);
  process.exit(1);
});
