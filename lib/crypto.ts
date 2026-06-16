import crypto from "crypto";
import bcrypt from "bcryptjs";

function mustGetEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function encryptionKey() {
  const secret = mustGetEnv("SESSION_SECRET");
  return crypto.scryptSync(secret, "mfcms", 32);
}

export function encryptString(plaintext: string) {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:.${tag.toString("base64")}:.${ciphertext.toString("base64")}`;
}

export function decryptString(ciphertext: string) {
  if (!ciphertext.startsWith("v1:")) throw new Error("Unsupported ciphertext format");
  const rest = ciphertext.slice(3);
  const parts = rest.split(`:.`);
  if (parts.length !== 3) throw new Error("Malformed ciphertext");
  const [ivB64, tagB64, dataB64] = parts;

  const key = encryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}

export async function hashPassword(password: string) {
  const pepper = mustGetEnv("PASSWORD_PEPPER");
  return bcrypt.hash(password + pepper, 12);
}

export async function verifyPassword(password: string, hash: string) {
  const pepper = mustGetEnv("PASSWORD_PEPPER");
  return bcrypt.compare(password + pepper, hash);
}
