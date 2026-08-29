const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const qrController = require("../src/controllers/qrController");
const { MongoMemoryServer } = require("mongodb-memory-server");
const fs = require("fs");

async function runTest() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("qr-bulk-test-2");
  process.env.QR_BASE_URL = "http://localhost:3000";
  await connectDB();

  const req = {
    body: { quantity: 10 }
  };

  const res = {
    headers: {},
    attachment(filename) {
      console.log("Attachment:", filename);
      this.headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    },
    on(event, cb) {
      console.log("Res on:", event);
    },
    once(event, cb) {
      console.log("Res once:", event);
    },
    emit(event, ...args) {
      console.log("Res emit:", event);
    },
    write(chunk) {
      // ignore
      return true;
    },
    end() {
      console.log("Stream ended.");
    },
    status(code) {
      console.log("Status:", code);
      return this;
    },
    json(data) {
      console.log("JSON:", data);
      return this;
    }
  };

  try {
    await qrController.bulkCreateQrs(req, res);
    console.log("bulkCreateQrs completed without throwing.");
  } catch (err) {
    console.error("bulkCreateQrs threw an error:", err);
  }

  await mongod.stop();
}

runTest().catch(console.error);
