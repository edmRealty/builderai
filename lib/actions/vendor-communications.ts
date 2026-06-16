"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";

const communicationSchema = z.object({
  vendorId: z.string().min(1),
  type: z.enum(["CALL", "TEXT", "EMAIL"]),
  note: z.string().optional().or(z.literal("")),
  returnTo: z.string().optional().or(z.literal(""))
});

const communicationLabels = {
  CALL: "Call",
  TEXT: "Text",
  EMAIL: "Email"
} as const;

function safeReturnTo(value: string | undefined) {
  if (value?.startsWith("/app/")) return value;
  return "/app/vendors";
}

async function createVendorCommunicationRecords(formData: FormData) {
  const user = await requireUser();
  const data = communicationSchema.parse({
    vendorId: formData.get("vendorId"),
    type: formData.get("type"),
    note: formData.get("note") ?? "",
    returnTo: formData.get("returnTo") ?? ""
  });

  const vendor = await prisma.vendor.findUnique({
    where: { id: data.vendorId },
    select: { id: true, orgId: true, name: true }
  });
  if (!vendor || vendor.orgId !== user.orgId) redirect("/app/vendors");

  const projectIds = [...new Set(formData.getAll("projectIds").map(String).filter(Boolean))];
  if (projectIds.length) {
    const relatedCommitments = await prisma.commitment.findMany({
      where: {
        orgId: user.orgId,
        vendorId: vendor.id,
        projectId: { in: projectIds }
      },
      select: { projectId: true }
    });
    const relatedProjectIds = new Set(relatedCommitments.map((c) => c.projectId));
    if (projectIds.some((projectId) => !relatedProjectIds.has(projectId))) redirect("/app/vendors");
  }

  for (const projectId of projectIds) {
    await requireProject(user, projectId);
  }

  const note = data.note?.trim() || `${communicationLabels[data.type]} logged from the vendor CRM quick action.`;
  const projectTargets = projectIds.length ? projectIds : [null];

  const communications = await prisma.$transaction(
    projectTargets.map((projectId) =>
      prisma.vendorCommunication.create({
        data: {
          orgId: user.orgId,
          vendorId: vendor.id,
          projectId,
          createdByUserId: user.id,
          type: data.type,
          note
        }
      })
    )
  );

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "VENDOR_COMMUNICATION_LOGGED",
    entityType: "VendorCommunication",
    entityId: communications[0]?.id ?? null,
    data: {
      vendorId: vendor.id,
      vendorName: vendor.name,
      type: data.type,
      projectIds
    }
  });

  return {
    vendorId: vendor.id,
    projectIds,
    returnTo: safeReturnTo(data.returnTo)
  };
}

export async function recordVendorCommunication(formData: FormData) {
  const result = await createVendorCommunicationRecords(formData);
  revalidatePath("/app/vendors");
  revalidatePath(`/app/vendors/${result.vendorId}`);
  for (const projectId of result.projectIds) {
    revalidatePath(`/app/projects/${projectId}`);
  }
  return result;
}

export async function logVendorCommunication(formData: FormData) {
  const result = await recordVendorCommunication(formData);
  redirect(result.returnTo);
}
