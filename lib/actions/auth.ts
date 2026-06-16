"use server";

import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/audit";
import { createSession, destroySession, isMfaDisabled, roleRequiresMfa } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import {
  consumeMfaChallenge,
  createMfaChallenge,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  getMfaChallengeUser,
  totpKeyUri,
  verifyTotp
} from "@/lib/mfa";

const setupSchema = z.object({
  orgName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8)
});

export async function setupFirstAdmin(formData: FormData) {
  const orgCount = await prisma.organization.count();
  if (orgCount > 0) redirect("/signin");

  const data = setupSchema.parse({
    orgName: formData.get("orgName"),
    adminEmail: formData.get("adminEmail"),
    adminPassword: formData.get("adminPassword")
  });

  const passwordHash = await hashPassword(data.adminPassword);

  const org = await prisma.organization.create({
    data: {
      name: data.orgName,
      users: {
        create: {
          email: data.adminEmail.toLowerCase(),
          role: "ADMIN",
          passwordHash
        }
      }
    },
    include: { users: true }
  });

  const adminUser = org.users[0]!;

  await auditEvent({
    orgId: org.id,
    userId: adminUser.id,
    action: "ORG_CREATED",
    entityType: "Organization",
    entityId: org.id,
    data: { orgName: org.name }
  });

  if (isMfaDisabled()) {
    await createSession(adminUser.id);
    redirect("/app/dashboard");
  }

  await createMfaChallenge(adminUser.id);
  redirect("/mfa/setup");
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function startLogin(formData: FormData) {
  const data = loginSchema.parse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() }
  });

  // Avoid user enumeration
  if (!user) return { ok: false as const, error: "Invalid email or password" };

  const ok = await verifyPassword(data.password, user.passwordHash);
  if (!ok) return { ok: false as const, error: "Invalid email or password" };

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const needsMfa = !isMfaDisabled() && (roleRequiresMfa(user.role) || user.mfaEnabled);
  if (needsMfa) {
    await createMfaChallenge(user.id);
    if (!user.mfaSecretEnc) redirect("/mfa/setup");
    redirect("/mfa/verify");
  }

  await createSession(user.id);
  redirect("/app/dashboard");
}

export async function devLoginAsDemo() {
  if (process.env.NODE_ENV === "production") redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { email: "demo-admin@mfcms.local" }
  });

  if (!user) {
    // If seed wasn't run yet, send user to setup.
    redirect("/setup");
  }

  await createSession(user.id);
  redirect("/app/dashboard");
}

function allowDemoOneClickLogin() {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") return false;
  if (process.env.ALLOW_INSECURE_AUTH !== "true") return false;

  const env = (process.env.MFCMS_ENV ?? "").toLowerCase();
  return env === "staging" || env === "demo";
}

export async function demoLoginAsDemoAdmin() {
  if (!allowDemoOneClickLogin()) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { email: "demo-admin@mfcms.local" }
  });

  if (!user) redirect("/setup");

  await createSession(user.id);
  redirect("/app/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/signin");
}

const totpSchema = z.object({
  token: z.string().min(6).max(8)
});

export async function getMfaSetupQr() {
  const res = await getMfaChallengeUser();
  if (!res) redirect("/signin");

  const { user } = res;
  let secretEnc = user.mfaSecretEnc;
  if (!secretEnc) {
    const secret = generateTotpSecret();
    secretEnc = encryptTotpSecret(secret);
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecretEnc: secretEnc }
    });
  }

  const secret = decryptTotpSecret(secretEnc);
  const uri = totpKeyUri({ label: user.email, secret });
  const qrDataUrl = await QRCode.toDataURL(uri);
  return { qrDataUrl };
}

export async function completeMfaSetup(formData: FormData) {
  const parsed = totpSchema.parse({ token: formData.get("token") });
  const res = await getMfaChallengeUser();
  if (!res) return { ok: false as const, error: "Session expired. Please log in again." };

  const { user, challenge } = res;
  if (!user.mfaSecretEnc) return { ok: false as const, error: "MFA secret missing. Refresh and try again." };

  const secret = decryptTotpSecret(user.mfaSecretEnc);
  const ok = verifyTotp({ token: parsed.token, secret });
  if (!ok) return { ok: false as const, error: "Invalid code" };

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true }
  });

  await consumeMfaChallenge(challenge.id);
  await createSession(user.id);

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "MFA_ENABLED",
    entityType: "User",
    entityId: user.id
  });

  redirect("/app/dashboard");
}

export async function verifyMfaToken(formData: FormData) {
  const parsed = totpSchema.parse({ token: formData.get("token") });
  const res = await getMfaChallengeUser();
  if (!res) return { ok: false as const, error: "Session expired. Please log in again." };

  const { user, challenge } = res;
  if (!user.mfaSecretEnc) redirect("/mfa/setup");

  const secret = decryptTotpSecret(user.mfaSecretEnc!);
  const ok = verifyTotp({ token: parsed.token, secret });
  if (!ok) return { ok: false as const, error: "Invalid code" };

  await consumeMfaChallenge(challenge.id);
  await createSession(user.id);
  redirect("/app/dashboard");
}
