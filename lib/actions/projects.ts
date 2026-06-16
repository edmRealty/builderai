"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { auditEvent } from "@/lib/audit";
import { requireProject } from "@/lib/access";
import { ACTIVE_PROJECT_STATUS_VALUES, projectStatusMeta } from "@/lib/project-status";

const projectSchema = z.object({
  llcId: z.string().min(1),
  qbConnectionId: z.string().min(1),
  name: z.string().min(2),
  addressLine1: z.string().min(2),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  zip: z.string().min(5),
  unitCount: z.coerce.number().int().positive().optional(),
  cityNumber: z.string().optional()
});

export async function createProject(formData: FormData) {
  const user = await requireUser();
  if (user.role === "FIELD_AGENT" || user.role === "BANKER") redirect("/app/dashboard");

  const data = projectSchema.parse({
    llcId: formData.get("llcId"),
    qbConnectionId: formData.get("qbConnectionId"),
    name: formData.get("name"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
    unitCount: formData.get("unitCount") || undefined,
    cityNumber: formData.get("cityNumber") || undefined
  });

  const project = await prisma.project.create({
    data: {
      orgId: user.orgId,
      llcId: data.llcId,
      qbConnectionId: data.qbConnectionId,
      name: data.name,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 ?? null,
      city: data.city,
      state: data.state,
      zip: data.zip,
      unitCount: data.unitCount ?? null,
      cityNumber: data.cityNumber ?? null
    }
  });

  // Default assignment to creator for PM/field roles.
  await prisma.projectAssignment.create({
    data: {
      orgId: user.orgId,
      projectId: project.id,
      userId: user.id
    }
  }).catch(() => null);

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "PROJECT_CREATED",
    entityType: "Project",
    entityId: project.id,
    data: { name: project.name }
  });

  redirect(`/app/projects/${project.id}?tab=overview`);
}

const renameSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2)
});

export async function renameProject(formData: FormData) {
  const user = await requireUser();
  if (user.role === "FIELD_AGENT" || user.role === "BANKER") redirect("/app/dashboard");

  const data = renameSchema.parse({
    projectId: formData.get("projectId"),
    name: formData.get("name")
  });

  const project = await requireProject(user, data.projectId);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { name: data.name.trim() }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "PROJECT_RENAMED",
    entityType: "Project",
    entityId: updated.id,
    data: { name: updated.name }
  });

  redirect(`/app/projects/${updated.id}?tab=overview`);
}

const statusSchema = z.object({
  projectId: z.string().min(1),
  status: z.enum(ACTIVE_PROJECT_STATUS_VALUES)
});

export async function updateProjectStatus(formData: FormData) {
  const user = await requireUser();
  if (user.role === "FIELD_AGENT" || user.role === "BANKER") redirect("/app/dashboard");

  const data = statusSchema.parse({
    projectId: formData.get("projectId"),
    status: formData.get("status")
  });

  const project = await requireProject(user, data.projectId);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { status: data.status }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "PROJECT_STATUS_UPDATED",
    entityType: "Project",
    entityId: updated.id,
    data: { status: updated.status }
  });

  revalidatePath("/app/projects");
  revalidatePath(`/app/projects/${updated.id}`);

  const meta = projectStatusMeta(updated.status);
  return { status: meta.value, prompt: meta.prompt ?? null };
}
