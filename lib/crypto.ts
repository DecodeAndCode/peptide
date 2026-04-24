import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is not set.");
  }
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).");
  }
  return buf;
}

// Returns iv:authTag:ciphertext — all hex-encoded, colon-separated.
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret.");
  }
  const [ivHex, tagHex, encryptedHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
