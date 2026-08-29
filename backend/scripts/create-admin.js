const readline = require("readline");

process.env.NODE_ENV = process.env.NODE_ENV || "development";

const { env, validateEnv } = require("../src/config/env");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  validateEnv();

  const email = (process.argv[2] || env.adminSetupEmail || "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: node scripts/create-admin.js <email>");
    console.error("   or: set ADMIN_SETUP_EMAIL in .env");
    process.exit(1);
  }

  const password = await ask("Choose a password (min 8 chars): ");

  if (typeof password !== "string" || password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const username = await ask("Enter your name (e.g. Zaid Khan): ");

  const connectDB = require("../src/config/db");
  await connectDB();

  const authService = require("../src/services/authService");
  const otpService = require("../src/services/otpService");
  const User = require("../src/models/User");

  const existing = await User.findOne({ email });

  let user;
  if (existing) {
    user = existing;
    console.log(`Admin account already exists for ${email}.`);
  } else {
    user = await authService.provisionAdmin({
      email,
      password,
      username: username.trim() || email.split("@")[0],
    });
    console.log(`Admin account created for ${email} (verified: false).`);
  }

  if (!user.active) {
    console.error("This account is disabled. Enable it before verifying.");
    process.exit(1);
  }

  try {
    await otpService.issueOtp(email);
    console.log(`\nA verification code was emailed to ${email}.`);
    console.log("Verify with:");
    console.log(`  curl -X POST <BASE_URL>/api/auth/verify-email \\`);
    console.log(`    -H "content-type: application/json" \\`);
    console.log(`    -d '{"email":"${email}","otp":"<CODE>"}'`);
  } catch (err) {
    if (err.statusCode === 503 || /not configured/i.test(err.message)) {
      console.error("\nCould not send the OTP email: the Gmail sender is not configured.");
      console.error("Set GOOGLE_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN,");
      console.error("then re-run this script to resend the code.");
    } else {
      throw err;
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to provision admin:", err.message);
  process.exit(1);
});
