"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";

const createSchema = z.object({
  projectId: z.string().min(1),
  body: z.string().min(2),
  dueAt: z.string().optional().or(z.literal(""))
});

export async function createReminder(formData: FormData) {
  const user = await requireUser();
  const data = createSchema.parse({
    projectId: formData.get("projectId"),
    body: formData.get("body"),
    dueAt: formData.get("dueAt") ?? ""
  });

  await requireProject(user, data.projectId);

  const dueAt = data.dueAt ? new Date(data.dueAt) : null;

  const reminder = await prisma.reminder.create({
    data: {
      orgId: user.orgId,
      projectId: data.projectId,
      createdByUserId: user.id,
      body: data.body.trim(),
      dueAt
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "REMINDER_CREATED",
    entityType: "Reminder",
    entityId: reminder.id,
    data: { projectId: data.projectId }
  });

  redirect(`/app/projects/${data.projectId}?tab=overview#reminders`);
}

const toggleSchema = z.object({
  reminderId: z.string().min(1)
});

export async function toggleReminderCompleted(formData: FormData) {
  const user = await requireUser();
  const data = toggleSchema.parse({ reminderId: formData.get("reminderId") });

  const reminder = await prisma.reminder.findUnique({ where: { id: data.reminderId } });
  if (!reminder || reminder.orgId !== user.orgId) redirect("/app/projects");

  await requireProject(user, reminder.projectId);

  const completedAt = reminder.completedAt ? null : new Date();
  const updated = await prisma.reminder.update({
    where: { id: reminder.id },
    data: { completedAt }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: completedAt ? "REMINDER_COMPLETED" : "REMINDER_REOPENED",
    entityType: "Reminder",
    entityId: updated.id,
    data: { projectId: reminder.projectId }
  });

  redirect(`/app/projects/${reminder.projectId}?tab=overview#reminders`);
}
