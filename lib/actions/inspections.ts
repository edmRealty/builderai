"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { assertCanMutateProject, requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2),
  required: z.coerce.boolean().optional(),
  linkUrl: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal(""))
});

export async function createInspection(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = createSchema.parse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    required: formData.get("required") ?? undefined,
    linkUrl: formData.get("linkUrl") ?? "",
    notes: formData.get("notes") ?? ""
  });

  await requireProject(user, data.projectId);

  const notes = [data.notes?.trim(), data.linkUrl?.trim()].filter(Boolean).join("\n");

  const inspection = await prisma.inspection.create({
    data: {
      orgId: user.orgId,
      projectId: data.projectId,
      name: data.name.trim(),
      required: data.required ?? true,
      notes: notes || null
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "INSPECTION_CREATED",
    entityType: "Inspection",
    entityId: inspection.id
  });

  redirect(`/app/projects/${data.projectId}?tab=docs`);
}

const completeSchema = z.object({
  inspectionId: z.string().min(1)
});

export async function markInspectionCompleted(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = completeSchema.parse({
    inspectionId: formData.get("inspectionId")
  });

  const inspection = await prisma.inspection.findUnique({ where: { id: data.inspectionId } });
  if (!inspection || inspection.orgId !== user.orgId) redirect("/app/projects");

  await requireProject(user, inspection.projectId);

  const updated = await prisma.inspection.update({
    where: { id: inspection.id },
    data: { completedAt: inspection.completedAt ?? new Date() }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "INSPECTION_COMPLETED",
    entityType: "Inspection",
    entityId: updated.id
  });

  redirect(`/app/projects/${inspection.projectId}?tab=docs`);
}
