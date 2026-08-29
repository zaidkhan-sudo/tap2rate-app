const crypto = require("crypto");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const DEFAULT_LENGTH = 6;

function generateQrId(length = DEFAULT_LENGTH) {
  const alphabetLength = ALPHABET.length;
  const limit = Math.floor(256 / alphabetLength) * alphabetLength;

  let id = "";
  while (id.length < length) {
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < bytes.length && id.length < length; i++) {
      if (bytes[i] < limit) {
        id += ALPHABET[bytes[i] % alphabetLength];
      }
    }
  }

  return id;
}

module.exports = { generateQrId, ALPHABET };
