const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../backend/.env") });
require("dotenv").config();

const connectDB = require("../backend/src/config/db");
const app = require("../backend/src/app");
const { validateEnv } = require("../backend/src/config/env");

let validated = false;

module.exports = async (req, res) => {
  if (!validated) {
    validateEnv();
    validated = true;
  }
  await connectDB();
  return app(req, res);
};
