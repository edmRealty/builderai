"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createSession, isMfaDisabled, roleRequiresMfa } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { createMfaChallenge } from "@/lib/mfa";

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
