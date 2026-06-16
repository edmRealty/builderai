import crypto from "crypto";

export function generateCommitmentCode() {
  // human-friendly, case-insensitive
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `CMT-${out}`;
}
