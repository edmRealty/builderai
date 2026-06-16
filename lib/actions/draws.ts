"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { auditEvent } from "@/lib/audit";
import { parseMoneyToCents } from "@/lib/money";

async function requireLoanAccess(userId: string, orgId: string, loanId: string) {
  const link = await prisma.loanBanker.findFirst({
    where: { orgId, loanId, userId }
  });
  if (!link) redirect("/app/dashboard");
}

const approveSchema = z.object({
  drawRequestId: z.string().min(1),
  comment: z.string().optional().or(z.literal(""))
});

export async function bankerApproveDraw(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "BANKER") redirect("/app/dashboard");

  const data = approveSchema.parse({
    drawRequestId: formData.get("drawRequestId"),
    comment: formData.get("comment") ?? ""
  });

  const draw = await prisma.drawRequest.findUnique({
    where: { id: data.drawRequestId },
    include: { loan: true, project: true }
  });
  if (!draw || draw.orgId !== user.orgId) redirect("/app/dashboard");

  await requireLoanAccess(user.id, user.orgId, draw.loanId);

  const updated = await prisma.drawRequest.update({
    where: { id: draw.id },
    data: {
      status: "APPROVED",
      lockedAt: new Date(),
      approvedAt: new Date(),
      approvedByUserId: user.id,
      approvedComment: data.comment || null
    }
  });

  // Notify project-assigned users.
  const assigned = await prisma.projectAssignment.findMany({
    where: { orgId: user.orgId, projectId: draw.projectId },
    select: { userId: true }
  });

  if (assigned.length > 0) {
    await prisma.notification.createMany({
      data: assigned.map((a) => ({
        orgId: user.orgId,
        userId: a.userId,
        type: "DRAW_APPROVED",
        title: "Draw approved",
        body: `${draw.project.name} • ${draw.id}`,
        entityType: "DrawRequest",
        entityId: updated.id
      }))
    });
  }

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "DRAW_APPROVED",
    entityType: "DrawRequest",
    entityId: updated.id,
    data: { comment: data.comment }
  });

  redirect("/app/banker");
}

export async function bankerRequestInfo(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "BANKER") redirect("/app/dashboard");

  const data = approveSchema.parse({
    drawRequestId: formData.get("drawRequestId"),
    comment: formData.get("comment") ?? ""
  });

  const draw = await prisma.drawRequest.findUnique({
    where: { id: data.drawRequestId },
    include: { loan: true, project: true }
  });
  if (!draw || draw.orgId !== user.orgId) redirect("/app/dashboard");

  await requireLoanAccess(user.id, user.orgId, draw.loanId);

  const updated = await prisma.drawRequest.update({
    where: { id: draw.id },
    data: {
      status: "NEEDS_INFO",
      approvedComment: data.comment || null
    }
  });

  const assigned = await prisma.projectAssignment.findMany({
    where: { orgId: user.orgId, projectId: draw.projectId },
    select: { userId: true }
  });

  if (assigned.length > 0) {
    await prisma.notification.createMany({
      data: assigned.map((a) => ({
        orgId: user.orgId,
        userId: a.userId,
        type: "DRAW_NEEDS_INFO",
        title: "Draw needs info",
        body: data.comment || "Bank requested more info.",
        entityType: "DrawRequest",
        entityId: updated.id
      }))
    });
  }

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "DRAW_NEEDS_INFO",
    entityType: "DrawRequest",
    entityId: updated.id,
    data: { comment: data.comment }
  });

  redirect("/app/banker");
}

export async function bankerRejectDraw(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "BANKER") redirect("/app/dashboard");

  const data = approveSchema.parse({
    drawRequestId: formData.get("drawRequestId"),
    comment: formData.get("comment") ?? ""
  });

  const draw = await prisma.drawRequest.findUnique({
    where: { id: data.drawRequestId },
    include: { loan: true, project: true }
  });
  if (!draw || draw.orgId !== user.orgId) redirect("/app/dashboard");

  await requireLoanAccess(user.id, user.orgId, draw.loanId);

  const updated = await prisma.drawRequest.update({
    where: { id: draw.id },
    data: {
      status: "REJECTED",
      approvedComment: data.comment || null
    }
  });

  const assigned = await prisma.projectAssignment.findMany({
    where: { orgId: user.orgId, projectId: draw.projectId },
    select: { userId: true }
  });

  if (assigned.length > 0) {
    await prisma.notification.createMany({
      data: assigned.map((a) => ({
        orgId: user.orgId,
        userId: a.userId,
        type: "DRAW_REJECTED",
        title: "Draw rejected",
        body: data.comment || "Bank rejected the draw.",
        entityType: "DrawRequest",
        entityId: updated.id
      }))
    });
  }

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "DRAW_REJECTED",
    entityType: "DrawRequest",
    entityId: updated.id,
    data: { comment: data.comment }
  });

  redirect("/app/banker");
}

const createDrawSchema = z.object({
  projectId: z.string().min(1),
  loanId: z.string().min(1),
  templateId: z.string().min(1),
  deliveryEmailTo: z.string().optional().or(z.literal(""))
});

export async function createDrawRequest(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = createDrawSchema.parse({
    projectId: formData.get("projectId"),
    loanId: formData.get("loanId"),
    templateId: formData.get("templateId"),
    deliveryEmailTo: formData.get("deliveryEmailTo") ?? ""
  });

  const project = await prisma.project.findFirst({
    where: { id: data.projectId, orgId: user.orgId }
  });
  if (!project) redirect("/app/projects");

  const loan = await prisma.loan.findFirst({ where: { id: data.loanId, orgId: user.orgId, projectId: project.id } });
  if (!loan) redirect(`/app/projects/${project.id}?tab=draws`);

  const template = await prisma.drawTemplate.findFirst({ where: { id: data.templateId, orgId: user.orgId, bankId: loan.bankId } });
  if (!template) redirect(`/app/projects/${project.id}?tab=draws`);

  const deliveryEmailTo = (data.deliveryEmailTo || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const draw = await prisma.drawRequest.create({
    data: {
      orgId: user.orgId,
      projectId: project.id,
      loanId: loan.id,
      templateId: template.id,
      status: "DRAFT",
      deliveryEmailTo
    }
  });

  // MVP line items: one per commitment.
  const commitments = await prisma.commitment.findMany({
    where: { orgId: user.orgId, projectId: project.id },
    orderBy: { createdAt: "asc" }
  });

  if (commitments.length > 0) {
    await prisma.drawLineItem.createMany({
      data: commitments.map((c) => ({
        orgId: user.orgId,
        drawRequestId: draw.id,
        label: c.scope,
        costCode: c.costCode,
        scheduledCents: c.agreedCents,
        previousDrawCents: 0,
        thisDrawCents: c.status === "COMPLETED" ? c.agreedCents : 0,
        retainageCents: 0,
        percentComplete: c.status === "COMPLETED" ? 100 : 0,
        commitmentId: c.id
      }))
    });
  }

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "DRAW_CREATED",
    entityType: "DrawRequest",
    entityId: draw.id
  });

  redirect(`/app/projects/${project.id}/draws/${draw.id}`);
}

const readySchema = z.object({ drawRequestId: z.string().min(1) });

export async function setDrawReadyForBank(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = readySchema.parse({ drawRequestId: formData.get("drawRequestId") });

  const draw = await prisma.drawRequest.findUnique({ where: { id: data.drawRequestId }, include: { project: true } });
  if (!draw || draw.orgId !== user.orgId) redirect("/app/projects");

  await prisma.drawRequest.update({ where: { id: draw.id }, data: { status: "READY_FOR_BANK_REVIEW" } });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "DRAW_READY_FOR_BANK",
    entityType: "DrawRequest",
    entityId: draw.id
  });

  redirect(`/app/projects/${draw.projectId}/draws/${draw.id}`);
}

const updateLineSchema = z.object({
  lineItemId: z.string().min(1),
  percentComplete: z.coerce.number().min(0).max(100).optional(),
  thisDraw: z.string().optional().or(z.literal("")),
  retainage: z.string().optional().or(z.literal(""))
});

export async function updateDrawLineItem(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = updateLineSchema.parse({
    lineItemId: formData.get("lineItemId"),
    percentComplete: formData.get("percentComplete") ?? undefined,
    thisDraw: formData.get("thisDraw") ?? "",
    retainage: formData.get("retainage") ?? ""
  });

  const li = await prisma.drawLineItem.findUnique({
    where: { id: data.lineItemId },
    include: { drawRequest: true }
  });
  if (!li || li.orgId !== user.orgId) redirect("/app/projects");

  const draw = await prisma.drawRequest.findUnique({
    where: { id: li.drawRequestId },
    include: { project: true }
  });
  if (!draw || draw.orgId !== user.orgId) redirect("/app/projects");

  if (draw.lockedAt || draw.status !== "DRAFT") {
    redirect(`/app/projects/${draw.projectId}/draws/${draw.id}`);
  }

  const thisDrawCents = data.thisDraw ? parseMoneyToCents(data.thisDraw) : li.thisDrawCents ?? 0;
  const retainageCents = data.retainage ? parseMoneyToCents(data.retainage) : li.retainageCents ?? 0;

  await prisma.drawLineItem.update({
    where: { id: li.id },
    data: {
      percentComplete: Number.isFinite(data.percentComplete as any) ? (data.percentComplete as number) : li.percentComplete ?? 0,
      thisDrawCents,
      retainageCents
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "DRAW_LINEITEM_UPDATED",
    entityType: "DrawLineItem",
    entityId: li.id,
    data: { drawRequestId: draw.id }
  });

  redirect(`/app/projects/${draw.projectId}/draws/${draw.id}`);
}
