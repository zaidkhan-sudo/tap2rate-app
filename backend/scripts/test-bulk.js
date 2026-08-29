const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const qrService = require("../src/services/qrService");
const { MongoMemoryServer } = require("mongodb-memory-server");

async function runTest() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("qr-bulk-test");
  await connectDB();

  try {
    console.log("Testing quantity < 1");
    await qrService.createBulkQrs(0);
    throw new Error("Should have thrown");
  } catch(e) {
    console.log("Caught:", e.message);
  }

  try {
    console.log("Testing quantity > 500");
    await qrService.createBulkQrs(501);
    throw new Error("Should have thrown");
  } catch(e) {
    console.log("Caught:", e.message);
  }

  console.log("Testing valid bulk create (50)...");
  const qrs = await qrService.createBulkQrs(50);
  console.log(`Generated ${qrs.length} QRs`);
  
  if (qrs.length !== 50) throw new Error("Expected 50 QRs");
  if (qrs[0].status !== "UNUSED") throw new Error("Expected UNUSED status");
  
  const stats = await qrService.getStats();
  console.log("Stats:", stats);

  await mongod.stop();
  console.log("Tests passed!");
}

runTest().catch(console.error);
