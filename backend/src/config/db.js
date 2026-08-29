const mongoose = require("mongoose");

const cached = (global.mongoose = global.mongoose || { conn: null, promise: null });

function attachConnectionListeners() {
  const conn = mongoose.connection;

  if (conn.listenerCount("error") === 0) {
    conn.on("error", (err) => {
      console.error("[db] MongoDB connection error:", err.message);
    });
  }

  if (conn.listenerCount("disconnected") === 0) {
    conn.on("disconnected", () => {
      console.error("[db] MongoDB disconnected");
    });
  }

  if (conn.listenerCount("reconnected") === 0) {
    conn.on("reconnected", () => {
      console.log("[db] MongoDB reconnected");
    });
  }
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    attachConnectionListeners();
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }

  return cached.conn;
}

module.exports = connectDB;
