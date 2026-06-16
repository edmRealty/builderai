"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { assertCanMutateProject, requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";

const planSetSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2),
  version: z.string().min(1),
  receivedAt: z.string().optional().or(z.literal("")),
  linkUrl: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal(""))
});

export async function createPlanSet(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = planSetSchema.parse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    version: formData.get("version"),
    receivedAt: formData.get("receivedAt") ?? "",
    linkUrl: formData.get("linkUrl") ?? "",
    notes: formData.get("notes") ?? ""
  });

  await requireProject(user, data.projectId);

  const receivedAt = data.receivedAt ? new Date(data.receivedAt) : null;
  const notes = [data.notes?.trim(), data.linkUrl?.trim()].filter(Boolean).join("\n");

  const planSet = await prisma.planSet.create({
    data: {
      orgId: user.orgId,
      projectId: data.projectId,
      name: data.name.trim(),
      version: data.version.trim(),
      receivedAt,
      notes: notes || null
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "PLANSET_CREATED",
    entityType: "PlanSet",
    entityId: planSet.id
  });

  redirect(`/app/projects/${data.projectId}?tab=docs`);
}
