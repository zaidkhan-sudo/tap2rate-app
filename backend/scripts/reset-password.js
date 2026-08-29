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

  const email = (process.argv[2] || "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: node scripts/reset-password.js <email>");
    process.exit(1);
  }

  const password = await ask("Enter NEW password (min 8 chars): ");

  if (typeof password !== "string" || password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const connectDB = require("../src/config/db");
  await connectDB();

  const User = require("../src/models/User");
  const authService = require("../src/services/authService");
  const { hashPassword } = require("../src/utils/passwords");

  const user = await User.findOne({ email });

  if (!user) {
    console.error(`Error: No account found for email: ${email}`);
    process.exit(1);
  }

  const newHash = await hashPassword(password);
  
  user.passwordHash = newHash;
  await user.save();

  // Very important: If the password was leaked, we MUST revoke all active sessions 
  // so the attacker is immediately kicked out.
  const revokedCount = await authService.revokeAllSessions(user._id.toString());

  console.log(`\nSuccess! Password has been reset for ${email}.`);
  console.log(`Security: ${revokedCount} active session(s) were automatically logged out.`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to reset password:", err.message);
  process.exit(1);
});
