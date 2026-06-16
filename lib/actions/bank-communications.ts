"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";

const communicationSchema = z.object({
  bankId: z.string().min(1),
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
  return "/app/banks";
}

async function createBankCommunicationRecords(formData: FormData) {
  const user = await requireUser();
  const data = communicationSchema.parse({
    bankId: formData.get("bankId"),
    type: formData.get("type"),
    note: formData.get("note") ?? "",
    returnTo: formData.get("returnTo") ?? ""
  });

  const bank = await prisma.bank.findUnique({
    where: { id: data.bankId },
    select: { id: true, orgId: true, name: true }
  });
  if (!bank || bank.orgId !== user.orgId) redirect("/app/banks");

  const projectIds = [...new Set(formData.getAll("projectIds").map(String).filter(Boolean))];
  if (projectIds.length) {
    const relatedLoans = await prisma.loan.findMany({
      where: {
        orgId: user.orgId,
        bankId: bank.id,
        projectId: { in: projectIds }
      },
      select: { projectId: true }
    });
    const relatedProjectIds = new Set(relatedLoans.map((loan) => loan.projectId));
    if (projectIds.some((projectId) => !relatedProjectIds.has(projectId))) redirect("/app/banks");
  }

  for (const projectId of projectIds) {
    await requireProject(user, projectId);
  }

  const note = data.note?.trim() || `${communicationLabels[data.type]} logged from the bank CRM quick action.`;
  const projectTargets = projectIds.length ? projectIds : [null];

  const communications = await prisma.$transaction(
    projectTargets.map((projectId) =>
      prisma.bankCommunication.create({
        data: {
          orgId: user.orgId,
          bankId: bank.id,
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
    action: "BANK_COMMUNICATION_LOGGED",
    entityType: "BankCommunication",
    entityId: communications[0]?.id ?? null,
    data: {
      bankId: bank.id,
      bankName: bank.name,
      type: data.type,
      projectIds
    }
  });

  return {
    bankId: bank.id,
    projectIds,
    returnTo: safeReturnTo(data.returnTo)
  };
}

export async function recordBankCommunication(formData: FormData) {
  const result = await createBankCommunicationRecords(formData);
  revalidatePath("/app/banks");
  revalidatePath(`/app/banks/${result.bankId}`);
  for (const projectId of result.projectIds) {
    revalidatePath(`/app/projects/${projectId}`);
  }
  return result;
}

export async function logBankCommunication(formData: FormData) {
  const result = await recordBankCommunication(formData);
  redirect(result.returnTo);
}
