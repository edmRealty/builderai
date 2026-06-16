"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { assertCanMutateProject, requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";

const photoSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().optional().or(z.literal("")),
  url: z.string().url()
});

export async function addProjectPhoto(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = photoSchema.parse({
    projectId: formData.get("projectId"),
    title: formData.get("title") ?? "",
    url: formData.get("url")
  });

  await requireProject(user, data.projectId);

  const photo = await prisma.projectPhoto.create({
    data: {
      orgId: user.orgId,
      projectId: data.projectId,
      title: data.title?.trim() || null,
      url: data.url.trim()
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "PROJECT_PHOTO_ADDED",
    entityType: "ProjectPhoto",
    entityId: photo.id
  });

  redirect(`/app/projects/${data.projectId}?tab=overview`);
}
