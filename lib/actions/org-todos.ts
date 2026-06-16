"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { auditEvent } from "@/lib/audit";

const createSchema = z.object({
  body: z.string().min(2),
  dueAt: z.string().optional()
});

export async function createOrgTodo(formData: FormData) {
  const user = await requireUser();
  if (user.role === "BANKER") redirect("/app/dashboard");

  const data = createSchema.parse({
    body: formData.get("body"),
    dueAt: formData.get("dueAt")?.toString() || undefined
  });

  const dueAt = data.dueAt ? new Date(`${data.dueAt}T00:00:00`) : null;

  const todo = await prisma.orgTodo.create({
    data: {
      orgId: user.orgId,
      createdByUserId: user.id,
      body: data.body,
      dueAt
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "ORG_TODO_CREATED",
    entityType: "OrgTodo",
    entityId: todo.id,
    data: { body: todo.body, dueAt: todo.dueAt?.toISOString() }
  });

  redirect("/app/dashboard");
}

const toggleSchema = z.object({
  todoId: z.string().min(1)
});

export async function toggleOrgTodoCompleted(formData: FormData) {
  const user = await requireUser();
  if (user.role === "BANKER") redirect("/app/dashboard");

  const data = toggleSchema.parse({
    todoId: formData.get("todoId")
  });

  const todo = await prisma.orgTodo.findUnique({ where: { id: data.todoId } });
  if (!todo || todo.orgId !== user.orgId) redirect("/app/dashboard");

  const nextCompletedAt = todo.completedAt ? null : new Date();

  const updated = await prisma.orgTodo.update({
    where: { id: todo.id },
    data: { completedAt: nextCompletedAt }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: updated.completedAt ? "ORG_TODO_COMPLETED" : "ORG_TODO_REOPENED",
    entityType: "OrgTodo",
    entityId: updated.id
  });

  redirect("/app/dashboard");
}

