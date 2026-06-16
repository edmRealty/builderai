"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { auditEvent } from "@/lib/audit";
import { encryptString } from "@/lib/crypto";

const llcSchema = z.object({
  name: z.string().min(2),
  legalName: z.string().optional(),
  ein: z.string().optional(),
  paTaxNumber: z.string().optional()
});

export async function createLlc(formData: FormData) {
  const user = await requireUser();
  if (user.role === "FIELD_AGENT" || user.role === "BANKER") redirect("/app/dashboard");

  const data = llcSchema.parse({
    name: formData.get("name"),
    legalName: formData.get("legalName") || undefined,
    ein: formData.get("ein") || undefined,
    paTaxNumber: formData.get("paTaxNumber") || undefined
  });

  const einEnc = data.ein ? encryptString(data.ein) : null;
  const paTaxNumberEnc = data.paTaxNumber ? encryptString(data.paTaxNumber) : null;

  const llc = await prisma.lLC.create({
    data: {
      orgId: user.orgId,
      name: data.name,
      legalName: data.legalName ?? null,
      einEnc,
      paTaxNumberEnc
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "LLC_CREATED",
    entityType: "LLC",
    entityId: llc.id,
    data: { name: llc.name }
  });

  redirect("/app/llcs");
}

const qbSchema = z.object({
  llcId: z.string().min(1),
  type: z.enum(["QBO", "QBD"]),
  displayName: z.string().min(2),
  qbdCompanyFileName: z.string().optional()
});

export async function createQbConnection(formData: FormData) {
  const user = await requireUser();
  if (user.role === "FIELD_AGENT" || user.role === "BANKER") redirect("/app/dashboard");

  const data = qbSchema.parse({
    llcId: formData.get("llcId"),
    type: formData.get("type"),
    displayName: formData.get("displayName"),
    qbdCompanyFileName: formData.get("qbdCompanyFileName") || undefined
  });

  const conn = await prisma.quickBooksConnection.create({
    data: {
      orgId: user.orgId,
      llcId: data.llcId,
      type: data.type,
      status: "DISABLED",
      displayName: data.displayName,
      qbdCompanyFileName: data.type === "QBD" ? data.qbdCompanyFileName ?? null : null
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "QB_CONNECTION_CREATED",
    entityType: "QuickBooksConnection",
    entityId: conn.id,
    data: { type: conn.type, displayName: conn.displayName }
  });

  redirect("/app/projects");
}
