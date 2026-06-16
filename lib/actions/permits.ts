"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { assertCanMutateProject, requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";

const permitSchema = z.object({
  projectId: z.string().min(1),
  permitType: z.string().min(2),
  jurisdiction: z.string().min(2),
  permitNumber: z.string().optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
  linkUrl: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal(""))
});

export async function createPermit(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = permitSchema.parse({
    projectId: formData.get("projectId"),
    permitType: formData.get("permitType"),
    jurisdiction: formData.get("jurisdiction"),
    permitNumber: formData.get("permitNumber") ?? "",
    expiresAt: formData.get("expiresAt") ?? "",
    linkUrl: formData.get("linkUrl") ?? "",
    notes: formData.get("notes") ?? ""
  });

  await requireProject(user, data.projectId);

  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  const notes = [data.notes?.trim(), data.linkUrl?.trim()].filter(Boolean).join("\n");

  const permit = await prisma.permit.create({
    data: {
      orgId: user.orgId,
      projectId: data.projectId,
      permitType: data.permitType,
      jurisdiction: data.jurisdiction,
      permitNumber: data.permitNumber || null,
      expiresAt,
      notes: notes || null
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "PERMIT_CREATED",
    entityType: "Permit",
    entityId: permit.id
  });

  redirect(`/app/projects/${data.projectId}?tab=docs`);
}
