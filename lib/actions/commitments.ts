"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { assertCanMutateProject, requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";
import { generateCommitmentCode } from "@/lib/codes";
import { parseMoneyToCents } from "@/lib/money";
import { encryptString, randomToken, sha256Hex } from "@/lib/crypto";

const createSchema = z.object({
  projectId: z.string().min(1),
  vendorId: z.string().min(1),
  scope: z.string().min(2),
  costCode: z.string().min(1),
  agreed: z.string().min(1),
  retainagePct: z.coerce.number().min(0).max(100).optional()
});

export async function createCommitment(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = createSchema.parse({
    projectId: formData.get("projectId"),
    vendorId: formData.get("vendorId"),
    scope: formData.get("scope"),
    costCode: formData.get("costCode"),
    agreed: formData.get("agreed"),
    retainagePct: formData.get("retainagePct") || undefined
  });

  await requireProject(user, data.projectId);

  const agreedCents = parseMoneyToCents(data.agreed);
  const retainageBps = Math.round(((data.retainagePct ?? 0) / 100) * 10000);

  // Generate a unique commitment code.
  let code = generateCommitmentCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.commitment.findUnique({ where: { code } });
    if (!exists) break;
    code = generateCommitmentCode();
  }

  const commitment = await prisma.commitment.create({
    data: {
      orgId: user.orgId,
      projectId: data.projectId,
      vendorId: data.vendorId,
      createdByUserId: user.id,
      code,
      scope: data.scope,
      costCode: data.costCode,
      agreedCents,
      retainageBps
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "COMMITMENT_CREATED",
    entityType: "Commitment",
    entityId: commitment.id,
    data: { code: commitment.code, agreedCents }
  });

  redirect(`/app/projects/${data.projectId}?tab=vendors`);
}

const completeSchema = z.object({
  commitmentId: z.string().min(1)
});

export async function markCommitmentCompleted(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = completeSchema.parse({
    commitmentId: formData.get("commitmentId")
  });

  const commitment = await prisma.commitment.findUnique({
    where: { id: data.commitmentId },
    include: { project: true, vendor: true }
  });
  if (!commitment || commitment.orgId !== user.orgId) redirect("/app/projects");

  await requireProject(user, commitment.projectId);

  // Field agent can only complete commitments they created.
  if (user.role === "FIELD_AGENT" && commitment.createdByUserId !== user.id) {
    redirect(`/app/projects/${commitment.projectId}?tab=vendors`);
  }

  const updated = await prisma.commitment.update({
    where: { id: commitment.id },
    data: {
      status: "COMPLETED",
      completedAt: commitment.completedAt ?? new Date()
    }
  });

  await prisma.expectedInvoice.upsert({
    where: { id: `ei_${updated.id}` },
    create: {
      id: `ei_${updated.id}`,
      orgId: user.orgId,
      commitmentId: updated.id
    },
    update: {}
  }).catch(async () => {
    // Fallback if custom id already exists or DB differs.
    await prisma.expectedInvoice.create({
      data: { orgId: user.orgId, commitmentId: updated.id }
    }).catch(() => null);
  });

  // Notify all accountants in org.
  const accountants = await prisma.user.findMany({
    where: { orgId: user.orgId, role: "ACCOUNTANT" },
    select: { id: true }
  });

  if (accountants.length > 0) {
    await prisma.notification.createMany({
      data: accountants.map((a) => ({
        orgId: user.orgId,
        userId: a.id,
        type: "COMMITMENT_COMPLETED",
        title: "Commitment marked completed",
        body: `${commitment.vendor.name}: ${commitment.scope} (${commitment.code})`,
        entityType: "Commitment",
        entityId: commitment.id
      }))
    });
  }

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "COMMITMENT_COMPLETED",
    entityType: "Commitment",
    entityId: commitment.id
  });

  redirect(`/app/projects/${commitment.projectId}?tab=vendors`);
}

const invoiceReqSchema = z.object({
  commitmentId: z.string().min(1)
});

export async function createVendorInvoiceRequest(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = invoiceReqSchema.parse({
    commitmentId: formData.get("commitmentId")
  });

  const commitment = await prisma.commitment.findUnique({
    where: { id: data.commitmentId },
    include: { project: true, vendor: true }
  });
  if (!commitment || commitment.orgId !== user.orgId) redirect("/app/projects");

  await requireProject(user, commitment.projectId);

  const token = randomToken(24);
  const tokenHash = sha256Hex(token);
  const tokenEnc = encryptString(token);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.vendorInvoiceRequest.create({
    data: {
      orgId: user.orgId,
      commitmentId: commitment.id,
      tokenHash,
      tokenEnc,
      expiresAt,
      vendorEmail: commitment.vendor.email
    }
  });

  // In Phase 1 we store the link in-app and emit notifications.
  // Email/SMS integration hooks are added next.
  await prisma.notification.create({
    data: {
      orgId: user.orgId,
      userId: user.id,
      type: "VENDOR_INVOICE_REQUEST_CREATED",
      title: "Vendor invoice upload link created",
      body: `${commitment.vendor.name} • ${commitment.code}`,
      entityType: "VendorInvoiceRequest",
      entityId: commitment.id
    }
  }).catch(() => null);

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "VENDOR_INVOICE_REQUEST_CREATED",
    entityType: "VendorInvoiceRequest",
    entityId: commitment.id
  });

  redirect(`/app/projects/${commitment.projectId}?tab=vendors`);
}
