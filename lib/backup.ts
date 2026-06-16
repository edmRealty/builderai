import crypto from "crypto";

export type BackupEnvelopeV1 =
  | {
    format: "mfcms-backup";
    version: 1;
    encrypted: false;
    exportedAt: string;
    appVersion: string;
    payload: unknown;
  }
  | {
    format: "mfcms-backup";
    version: 1;
    encrypted: true;
    exportedAt: string;
    appVersion: string;
    kdf: { name: "scrypt"; saltB64: string; N: number; r: number; p: number };
    cipher: { name: "aes-256-gcm"; ivB64: string; tagB64: string };
    ciphertextB64: string;
  };

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function deriveKey(passphrase: string, salt: Buffer) {
  return crypto.scryptSync(passphrase, salt, 32, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
}

export function encryptEnvelopeV1(opts: { passphrase: string; exportedAt: string; appVersion: string; payload: unknown }): BackupEnvelopeV1 {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(opts.passphrase, salt);

  const plaintext = Buffer.from(JSON.stringify(opts.payload), "utf8");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    format: "mfcms-backup",
    version: 1,
    encrypted: true,
    exportedAt: opts.exportedAt,
    appVersion: opts.appVersion,
    kdf: { name: "scrypt", saltB64: salt.toString("base64"), N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
    cipher: { name: "aes-256-gcm", ivB64: iv.toString("base64"), tagB64: tag.toString("base64") },
    ciphertextB64: ciphertext.toString("base64")
  };
}

export function decryptEnvelopeV1(envelope: BackupEnvelopeV1, passphrase?: string): unknown {
  if (envelope.format !== "mfcms-backup" || envelope.version !== 1) throw new Error("Unsupported backup format");
  if (!envelope.encrypted) return envelope.payload;
  if (!passphrase) throw new Error("Passphrase required to decrypt backup");

  const salt = Buffer.from(envelope.kdf.saltB64, "base64");
  const iv = Buffer.from(envelope.cipher.ivB64, "base64");
  const tag = Buffer.from(envelope.cipher.tagB64, "base64");
  const ciphertext = Buffer.from(envelope.ciphertextB64, "base64");

  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

