"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";

const updateSchema = z.object({
  projectId: z.string().min(1),
  body: z.string().min(2),
  tags: z.string().optional().or(z.literal(""))
});

export async function addProjectUpdate(formData: FormData) {
  const user = await requireUser();

  const data = updateSchema.parse({
    projectId: formData.get("projectId"),
    body: formData.get("body"),
    tags: formData.get("tags") ?? ""
  });

  await requireProject(user, data.projectId);

  const tags = (data.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);

  const update = await prisma.projectUpdate.create({
    data: {
      orgId: user.orgId,
      projectId: data.projectId,
      authorId: user.id,
      body: data.body,
      tags,
      photoDocIds: []
    }
  });

  // Notify assigned users (office) + bankers assigned via loans.
  const [assignedUsers, bankerUsers] = await Promise.all([
    prisma.projectAssignment.findMany({
      where: { orgId: user.orgId, projectId: data.projectId },
      select: { userId: true }
    }),
    prisma.loanBanker.findMany({
      where: { orgId: user.orgId, loan: { projectId: data.projectId } },
      select: { userId: true }
    })
  ]);

  const notifyUserIds = new Set<string>();
  for (const a of assignedUsers) notifyUserIds.add(a.userId);
  for (const b of bankerUsers) notifyUserIds.add(b.userId);
  notifyUserIds.delete(user.id);

  if (notifyUserIds.size > 0) {
    await prisma.notification.createMany({
      data: [...notifyUserIds].map((userId) => ({
        orgId: user.orgId,
        userId,
        type: "PROJECT_UPDATE",
        title: "New project update",
        body: data.body.slice(0, 140),
        entityType: "ProjectUpdate",
        entityId: update.id
      }))
    });
  }

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "PROJECT_UPDATE_CREATED",
    entityType: "ProjectUpdate",
    entityId: update.id
  });

  redirect(`/app/projects/${data.projectId}?tab=updates`);
}
