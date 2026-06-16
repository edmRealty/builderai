"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { hashPassword } from "@/lib/crypto";
import { auditEvent } from "@/lib/audit";

const userSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "PROJECT_MANAGER", "ACCOUNTANT", "FIELD_AGENT", "BANKER", "ADMIN"]),
  password: z.string().min(8)
});

export async function createUser(formData: FormData) {
  const actor = await requireUser();
  if (actor.role !== "ADMIN" && actor.role !== "OWNER") redirect("/app/dashboard");

  const data = userSchema.parse({
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password")
  });

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      orgId: actor.orgId,
      email: data.email.toLowerCase(),
      role: data.role,
      passwordHash
    }
  });

  await auditEvent({
    orgId: actor.orgId,
    userId: actor.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    data: { email: user.email, role: user.role }
  });

  redirect("/app/users");
}
