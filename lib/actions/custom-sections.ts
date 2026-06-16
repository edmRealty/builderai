"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { assertCanMutateProject, requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";

const createSectionSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(2),
  applyToAll: z.coerce.boolean().optional()
});

export async function createProjectCustomSection(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = createSectionSchema.parse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    applyToAll: formData.get("applyToAll") ?? undefined
  });

  await requireProject(user, data.projectId);

  const section = await prisma.projectCustomSection.create({
    data: {
      orgId: user.orgId,
      projectId: data.applyToAll ? null : data.projectId,
      title: data.title.trim()
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "PROJECT_CUSTOM_SECTION_CREATED",
    entityType: "ProjectCustomSection",
    entityId: section.id,
    data: { applyToAll: Boolean(data.applyToAll) }
  });

  redirect(`/app/projects/${data.projectId}?tab=docs`);
}

const addItemSchema = z.object({
  projectId: z.string().min(1),
  sectionId: z.string().min(1),
  title: z.string().min(2),
  url: z.string().url()
});

export async function addProjectCustomSectionItem(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = addItemSchema.parse({
    projectId: formData.get("projectId"),
    sectionId: formData.get("sectionId"),
    title: formData.get("title"),
    url: formData.get("url")
  });

  await requireProject(user, data.projectId);

  const section = await prisma.projectCustomSection.findUnique({ where: { id: data.sectionId } });
  if (!section || section.orgId !== user.orgId) redirect(`/app/projects/${data.projectId}?tab=docs`);

  await prisma.projectCustomSectionItem.create({
    data: {
      orgId: user.orgId,
      sectionId: section.id,
      title: data.title.trim(),
      url: data.url.trim()
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "PROJECT_CUSTOM_SECTION_ITEM_ADDED",
    entityType: "ProjectCustomSection",
    entityId: section.id
  });

  redirect(`/app/projects/${data.projectId}?tab=docs`);
}
