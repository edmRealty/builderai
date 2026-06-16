"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { auditEvent } from "@/lib/audit";

const renameSchema = z.object({
  llcId: z.string().min(1),
  name: z.string().min(2)
});

export async function renameLlc(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER"].includes(user.role)) redirect("/app/dashboard");

  const data = renameSchema.parse({
    llcId: formData.get("llcId"),
    name: formData.get("name")
  });

  const llc = await prisma.lLC.findUnique({ where: { id: data.llcId } });
  if (!llc || llc.orgId !== user.orgId) redirect("/app/llcs");

  const updated = await prisma.lLC.update({
    where: { id: llc.id },
    data: { name: data.name }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "LLC_RENAMED",
    entityType: "LLC",
    entityId: updated.id,
    data: { name: updated.name }
  });

  redirect("/app/llcs");
}

const deleteSchema = z.object({
  llcId: z.string().min(1)
});

export async function deleteLlc(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER"].includes(user.role)) redirect("/app/dashboard");

  const data = deleteSchema.parse({
    llcId: formData.get("llcId")
  });

  const llc = await prisma.lLC.findUnique({
    where: { id: data.llcId },
    include: { projects: { select: { id: true } } }
  });
  if (!llc || llc.orgId !== user.orgId) redirect("/app/llcs");

  if (llc.projects.length > 0) {
    redirect(`/app/llcs?error=LLC%20has%20projects%20and%20cannot%20be%20deleted`);
  }

  await prisma.lLC.delete({ where: { id: llc.id } });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "LLC_DELETED",
    entityType: "LLC",
    entityId: llc.id,
    data: { name: llc.name }
  });

  redirect("/app/llcs");
}

const updateDetailsSchema = z.object({
  llcId: z.string().min(1),
  legalName: z.string().optional(),
  establishedAt: z.string().optional(),
  oneDriveFolderUrl: z.string().url().optional().or(z.literal(""))
});

export async function updateLlcDetails(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = updateDetailsSchema.parse({
    llcId: formData.get("llcId"),
    legalName: formData.get("legalName")?.toString() || undefined,
    establishedAt: formData.get("establishedAt")?.toString() || undefined,
    oneDriveFolderUrl: formData.get("oneDriveFolderUrl")?.toString() || undefined
  });

  const llc = await prisma.lLC.findUnique({ where: { id: data.llcId } });
  if (!llc || llc.orgId !== user.orgId) redirect("/app/llcs");

  const establishedAt = data.establishedAt ? new Date(`${data.establishedAt}T00:00:00`) : null;
  const updated = await prisma.lLC.update({
    where: { id: llc.id },
    data: {
      legalName: data.legalName ?? null,
      establishedAt,
      oneDriveFolderUrl: data.oneDriveFolderUrl ? data.oneDriveFolderUrl : null
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "LLC_UPDATED",
    entityType: "LLC",
    entityId: updated.id
  });

  redirect(`/app/llcs/${updated.id}`);
}

const docSchema = z.object({
  llcId: z.string().min(1),
  title: z.string().min(2),
  url: z.string().url()
});

export async function addLlcDocument(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = docSchema.parse({
    llcId: formData.get("llcId"),
    title: formData.get("title"),
    url: formData.get("url")
  });

  const llc = await prisma.lLC.findUnique({ where: { id: data.llcId } });
  if (!llc || llc.orgId !== user.orgId) redirect("/app/llcs");

  const doc = await prisma.llcDocument.create({
    data: {
      orgId: user.orgId,
      llcId: llc.id,
      createdByUserId: user.id,
      title: data.title,
      url: data.url
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "LLC_DOC_ADDED",
    entityType: "LlcDocument",
    entityId: doc.id,
    data: { llcId: llc.id, title: doc.title }
  });

  redirect(`/app/llcs/${llc.id}`);
}

const partnerSchema = z.object({
  llcId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  ownershipPct: z.coerce.number().min(0).max(100)
});

export async function addLlcPartner(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = partnerSchema.parse({
    llcId: formData.get("llcId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    ownershipPct: formData.get("ownershipPct")
  });

  const llc = await prisma.lLC.findUnique({ where: { id: data.llcId } });
  if (!llc || llc.orgId !== user.orgId) redirect("/app/llcs");

  const partner = await prisma.partner.create({
    data: {
      orgId: user.orgId,
      name: data.name,
      email: data.email ? data.email : null,
      phone: data.phone ? data.phone : null
    }
  });

  const link = await prisma.llcPartner.create({
    data: {
      orgId: user.orgId,
      llcId: llc.id,
      partnerId: partner.id,
      ownershipBps: Math.round(data.ownershipPct * 100)
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "LLC_PARTNER_ADDED",
    entityType: "LlcPartner",
    entityId: link.id,
    data: { llcId: llc.id, partnerName: partner.name }
  });

  redirect(`/app/llcs/${llc.id}`);
}

const updateOwnershipSchema = z.object({
  llcPartnerId: z.string().min(1),
  ownershipPct: z.coerce.number().min(0).max(100)
});

export async function updateLlcPartnerOwnership(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = updateOwnershipSchema.parse({
    llcPartnerId: formData.get("llcPartnerId"),
    ownershipPct: formData.get("ownershipPct")
  });

  const link = await prisma.llcPartner.findUnique({
    where: { id: data.llcPartnerId },
    include: { llc: true, partner: true }
  });
  if (!link || link.orgId !== user.orgId) redirect("/app/llcs");

  await prisma.llcPartner.update({
    where: { id: link.id },
    data: { ownershipBps: Math.round(data.ownershipPct * 100) }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "LLC_PARTNER_UPDATED",
    entityType: "LlcPartner",
    entityId: link.id,
    data: { llcId: link.llcId, partnerName: link.partner.name }
  });

  redirect(`/app/llcs/${link.llcId}`);
}

const removePartnerSchema = z.object({
  llcPartnerId: z.string().min(1)
});

export async function removeLlcPartner(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER"].includes(user.role)) redirect("/app/dashboard");

  const data = removePartnerSchema.parse({
    llcPartnerId: formData.get("llcPartnerId")
  });

  const link = await prisma.llcPartner.findUnique({ where: { id: data.llcPartnerId } });
  if (!link || link.orgId !== user.orgId) redirect("/app/llcs");

  await prisma.llcPartner.delete({ where: { id: link.id } });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "LLC_PARTNER_REMOVED",
    entityType: "LlcPartner",
    entityId: link.id,
    data: { llcId: link.llcId }
  });

  redirect(`/app/llcs/${link.llcId}`);
}

