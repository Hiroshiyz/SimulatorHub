import * as crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
// Use ENCRYPTION_KEY from env, fallback for testing
const SECRET_KEY = process.env.ENCRYPTION_KEY || "a_very_secure_and_long_secret_key_32_chars";
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  if (!text) return "";
  const key = crypto.createHash("sha256").update(SECRET_KEY).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    // If not encrypted, return as is (useful for graceful transition/fallback)
    return encryptedText;
  }
  try {
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const key = crypto.createHash("sha256").update(SECRET_KEY).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    // Return original if decryption fails to ensure robustness
    return encryptedText;
  }
}
