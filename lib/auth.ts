import { cache } from "react";
import { cookies, headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { Role } from "@prisma/client";

const SESSION_COOKIE = "mfcms_session";
const SESSION_DAYS = 30;

export function isMfaDisabled() {
  // Default: allow disabling MFA for local/dev convenience only.
  // In staging/demo deployments, MFA can be disabled only when explicitly opted into.
  if (process.env.MFA_DISABLED !== "true") return false;

  if (process.env.NODE_ENV !== "production") return true;

  // Production builds run with NODE_ENV=production even for staging. Require an extra guard.
  // This prevents accidental MFA bypass in real production.
  const env = (process.env.MFCMS_ENV ?? "").toLowerCase();
  const allowInsecureAuth = process.env.ALLOW_INSECURE_AUTH === "true";
  return allowInsecureAuth && (env === "staging" || env === "demo");
}

export function roleRequiresMfa(role: Role) {
  if (isMfaDisabled()) return false;
  return role === "BANKER" || role === "ADMIN";
}

function nowPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256Hex(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  // best-effort touch
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  });

  return session.user;
});

export async function createSession(userId: string) {
  const token = randomToken(32);
  const tokenHash = sha256Hex(token);

  // `headers()` can throw in rare edge cases (e.g. forwarded Server Actions requests).
  // Session creation should still succeed even if request metadata isn't available.
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    userAgent = h.get("user-agent") ?? null;
  } catch {
    // best-effort only
  }

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt: nowPlusDays(SESSION_DAYS),
      ip,
      userAgent
    }
  });

  (await cookies()).set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: nowPlusDays(SESSION_DAYS)
  });
}

export async function destroySession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;

  const tokenHash = sha256Hex(token);
  await prisma.session.deleteMany({ where: { tokenHash } });

  (await cookies()).set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
}
