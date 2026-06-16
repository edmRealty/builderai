import { cookies } from "next/headers";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { decryptString, encryptString, randomToken, sha256Hex } from "@/lib/crypto";

const MFA_COOKIE = "mfcms_mfa";
const MFA_CHALLENGE_MINUTES = 10;

function nowPlusMinutes(minutes: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_LOOKUP = new Map<string, number>(
  BASE32_ALPHABET.split("").map((c, i) => [c, i])
);

function normalizeBase32(secret: string) {
  // Authenticator apps often show secrets with spaces; we accept and ignore them.
  return secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

function base32Encode(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      const idx = (value >>> (bits - 5)) & 31;
      output += BASE32_ALPHABET[idx]!;
      bits -= 5;
    }
  }

  if (bits > 0) {
    const idx = (value << (5 - bits)) & 31;
    output += BASE32_ALPHABET[idx]!;
  }

  // OTP secrets conventionally omit RFC4648 padding.
  return output;
}

function base32Decode(secret: string) {
  const normalized = normalizeBase32(secret);
  if (!normalized) return Buffer.alloc(0);

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const ch of normalized) {
    const v = BASE32_LOOKUP.get(ch);
    if (v === undefined) throw new Error("Invalid base32 secret");
    value = (value << 5) | v;
    bits += 5;

    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(out);
}

function hotp({ key, counter, digits }: { key: Buffer; counter: bigint; digits: number }) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);
  const hmac = crypto.createHmac("sha1", key).update(msg).digest();

  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const mod = 10 ** digits;
  const otp = (bin % mod).toString().padStart(digits, "0");
  return otp;
}

function totp({ secret, epochMs, stepSeconds, digits }: { secret: string; epochMs: number; stepSeconds: number; digits: number }) {
  const key = base32Decode(secret);
  if (key.length === 0) return null;

  const counter = BigInt(Math.floor(epochMs / 1000 / stepSeconds));
  return hotp({ key, counter, digits });
}

export function generateTotpSecret() {
  // 160-bit secret is common (20 bytes -> 32 base32 chars, no padding).
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

export function totpKeyUri({ label, secret }: { label: string; secret: string }) {
  const issuer = "MFCMS";
  const safeIssuer = encodeURIComponent(issuer);
  const safeLabel = encodeURIComponent(`${issuer}:${label}`);
  const safeSecret = normalizeBase32(secret);
  return `otpauth://totp/${safeLabel}?secret=${safeSecret}&issuer=${safeIssuer}`;
}

export function verifyTotp({ token, secret }: { token: string; secret: string }) {
  const normalizedToken = String(token ?? "").trim().replace(/\s+/g, "");
  if (!/^\d{6,8}$/.test(normalizedToken)) return false;

  const digits = normalizedToken.length;
  const stepSeconds = 30;

  // Tolerance: ±1 step (±30 seconds)
  const now = Date.now();
  for (const delta of [-1, 0, 1]) {
    const code = totp({ secret, epochMs: now + delta * stepSeconds * 1000, stepSeconds, digits });
    if (code && code === normalizedToken) return true;
  }
  return false;
}

export async function createMfaChallenge(userId: string) {
  const token = randomToken(24);
  const tokenHash = sha256Hex(token);

  await prisma.mfaChallenge.create({
    data: {
      userId,
      tokenHash,
      expiresAt: nowPlusMinutes(MFA_CHALLENGE_MINUTES)
    }
  });

  (await cookies()).set({
    name: MFA_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: nowPlusMinutes(MFA_CHALLENGE_MINUTES)
  });
}

export async function getMfaChallengeUser() {
  const token = (await cookies()).get(MFA_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256Hex(token);
  const challenge = await prisma.mfaChallenge.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!challenge) return null;
  if (challenge.usedAt) return null;
  if (challenge.expiresAt.getTime() < Date.now()) return null;

  return { challenge, user: challenge.user };
}

export async function consumeMfaChallenge(challengeId: string) {
  await prisma.mfaChallenge.update({
    where: { id: challengeId },
    data: { usedAt: new Date() }
  });

  (await cookies()).set({
    name: MFA_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
}

export function encryptTotpSecret(secret: string) {
  return encryptString(secret);
}

export function decryptTotpSecret(secretEnc: string) {
  return decryptString(secretEnc);
}
