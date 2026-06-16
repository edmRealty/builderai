"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { auditEvent } from "@/lib/audit";

const addSchema = z.object({
  projectId: z.string().min(1),
  label: z.string().min(2),
  value: z.string().min(1),
  applyToAllProjects: z.coerce.boolean().optional()
});

export async function addProjectIdentifier(formData: FormData) {
  const user = await requireUser();
  if (user.role === "BANKER") redirect("/app/dashboard");

  const data = addSchema.parse({
    projectId: formData.get("projectId"),
    label: formData.get("label"),
    value: formData.get("value"),
    applyToAllProjects: formData.get("applyToAllProjects") ? true : false
  });

  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project || project.orgId !== user.orgId) redirect("/app/projects");

  const def = await prisma.identifierDefinition.upsert({
    where: { orgId_scope_label: { orgId: user.orgId, scope: "PROJECT", label: data.label } },
    update: {
      applyToAllProjects: data.applyToAllProjects ?? false
    },
    create: {
      orgId: user.orgId,
      scope: "PROJECT",
      label: data.label,
      applyToAllProjects: data.applyToAllProjects ?? false,
      sortOrder: 100,
      createdByUserId: user.id
    }
  });

  const value = data.value.trim();

  const pi = await prisma.projectIdentifier.upsert({
    where: { projectId_definitionId: { projectId: project.id, definitionId: def.id } },
    update: { value },
    create: { orgId: user.orgId, projectId: project.id, definitionId: def.id, value }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "PROJECT_IDENTIFIER_SET",
    entityType: "ProjectIdentifier",
    entityId: pi.id,
    data: { projectId: project.id, label: def.label }
  });

  redirect(`/app/projects/${project.id}`);
}

