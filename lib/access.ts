import { redirect } from "next/navigation";
import { Role, type Project, type User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { projectScopeWhere } from "@/lib/scope";

export async function requireProject(user: Pick<User, "id" | "orgId" | "role">, projectId: string): Promise<Project> {
  const where = { ...projectScopeWhere(user), id: projectId };
  const project = await prisma.project.findFirst({ where });
  if (!project) redirect("/app/projects");
  return project;
}

export function assertCanMutateProject(user: Pick<User, "role">) {
  if (user.role === Role.BANKER) redirect("/app/dashboard");
}
