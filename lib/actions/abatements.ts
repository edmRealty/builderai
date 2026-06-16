"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { assertCanMutateProject, requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";

const abatementSchema = z.object({
  projectId: z.string().min(1),
  programName: z.string().min(2),
  termEnd: z.string().optional().or(z.literal("")),
  linkUrl: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal(""))
});

export async function createAbatement(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = abatementSchema.parse({
    projectId: formData.get("projectId"),
    programName: formData.get("programName"),
    termEnd: formData.get("termEnd") ?? "",
    linkUrl: formData.get("linkUrl") ?? "",
    notes: formData.get("notes") ?? ""
  });

  await requireProject(user, data.projectId);

  const termEnd = data.termEnd ? new Date(data.termEnd) : null;
  const notes = [data.notes?.trim(), data.linkUrl?.trim()].filter(Boolean).join("\n");

  const abatement = await prisma.abatement.create({
    data: {
      orgId: user.orgId,
      projectId: data.projectId,
      programName: data.programName,
      termEnd,
      notes: notes || null
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "ABATEMENT_CREATED",
    entityType: "Abatement",
    entityId: abatement.id
  });

  redirect(`/app/projects/${data.projectId}?tab=docs`);
}
