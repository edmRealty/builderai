"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { auditEvent } from "@/lib/audit";
import { parseMoneyToCents } from "@/lib/money";

function assertAdmin(userRole: string) {
  if (userRole !== "ADMIN" && userRole !== "OWNER") redirect("/app/dashboard");
}

const bankSchema = z.object({
  name: z.string().min(2),
  contactName: z.string().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal("")),
  loanName: z.string().optional().or(z.literal("")),
  loanNumber: z.string().optional().or(z.literal("")),
  totalLoan: z.string().optional().or(z.literal("")),
  paidToDate: z.string().optional().or(z.literal(""))
});

export async function createBank(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user.role);

  const data = bankSchema.parse({
    name: formData.get("name"),
    contactName: formData.get("contactName") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    projectId: formData.get("projectId") ?? "",
    loanName: formData.get("loanName") ?? "",
    loanNumber: formData.get("loanNumber") ?? "",
    totalLoan: formData.get("totalLoan") ?? "",
    paidToDate: formData.get("paidToDate") ?? ""
  });

  const bank = await prisma.$transaction(async (tx) => {
    const created = await tx.bank.create({
      data: {
        orgId: user.orgId,
        name: data.name,
        contactName: data.contactName || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null
      }
    });

    if (data.projectId) {
      const project = await tx.project.findFirst({ where: { id: data.projectId, orgId: user.orgId } });
      if (!project) redirect("/app/banks");

      const totalLoanCents = data.totalLoan ? parseMoneyToCents(data.totalLoan) : null;
      const paidToDateCents = data.paidToDate ? parseMoneyToCents(data.paidToDate) : 0;

      await tx.loan.create({
        data: {
          orgId: user.orgId,
          projectId: project.id,
          bankId: created.id,
          name: data.loanName || `Construction Loan - ${data.name}`,
          loanNumber: data.loanNumber || null,
          totalLoanCents,
          paidToDateCents
        }
      });
    }

    return created;
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "BANK_CREATED",
    entityType: "Bank",
    entityId: bank.id,
    data: { linkedProjectId: data.projectId || null }
  });

  redirect("/app/banks");
}

const templateSchema = z.object({
  bankId: z.string().min(1),
  name: z.string().min(2),
  configJson: z.string().min(2)
});

export async function createDrawTemplate(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user.role);

  const data = templateSchema.parse({
    bankId: formData.get("bankId"),
    name: formData.get("name"),
    configJson: formData.get("configJson")
  });

  const bank = await prisma.bank.findFirst({ where: { id: data.bankId, orgId: user.orgId } });
  if (!bank) redirect("/app/banks");

  const existingMax = await prisma.drawTemplate.aggregate({
    where: { bankId: bank.id, name: data.name },
    _max: { version: true }
  });

  const version = (existingMax._max.version ?? 0) + 1;

  let config: any;
  try {
    config = JSON.parse(data.configJson);
  } catch {
    config = { error: "Invalid JSON" };
  }

  const tpl = await prisma.drawTemplate.create({
    data: {
      orgId: user.orgId,
      bankId: bank.id,
      name: data.name,
      version,
      config
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "DRAW_TEMPLATE_CREATED",
    entityType: "DrawTemplate",
    entityId: tpl.id,
    data: { name: tpl.name, version: tpl.version }
  });

  redirect("/app/banks");
}

const loanSchema = z.object({
  projectId: z.string().min(1),
  bankId: z.string().min(1),
  name: z.string().min(2),
  loanNumber: z.string().optional().or(z.literal(""))
});

export async function createLoan(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user.role);

  const data = loanSchema.parse({
    projectId: formData.get("projectId"),
    bankId: formData.get("bankId"),
    name: formData.get("name"),
    loanNumber: formData.get("loanNumber") ?? ""
  });

  const [project, bank] = await Promise.all([
    prisma.project.findFirst({ where: { id: data.projectId, orgId: user.orgId } }),
    prisma.bank.findFirst({ where: { id: data.bankId, orgId: user.orgId } })
  ]);

  if (!project || !bank) redirect("/app/banks");

  const loan = await prisma.loan.create({
    data: {
      orgId: user.orgId,
      projectId: project.id,
      bankId: bank.id,
      name: data.name,
      loanNumber: data.loanNumber || null
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "LOAN_CREATED",
    entityType: "Loan",
    entityId: loan.id
  });

  redirect("/app/banks");
}

const assignSchema = z.object({
  loanId: z.string().min(1),
  bankerUserId: z.string().min(1)
});

export async function assignBanker(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user.role);

  const data = assignSchema.parse({
    loanId: formData.get("loanId"),
    bankerUserId: formData.get("bankerUserId")
  });

  const loan = await prisma.loan.findFirst({ where: { id: data.loanId, orgId: user.orgId } });
  const banker = await prisma.user.findFirst({ where: { id: data.bankerUserId, orgId: user.orgId, role: "BANKER" } });
  if (!loan || !banker) redirect("/app/banks");

  await prisma.loanBanker.upsert({
    where: { loanId_userId: { loanId: loan.id, userId: banker.id } },
    create: { orgId: user.orgId, loanId: loan.id, userId: banker.id },
    update: {}
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "BANKER_ASSIGNED",
    entityType: "Loan",
    entityId: loan.id,
    data: { bankerUserId: banker.id }
  });

  redirect("/app/banks");
}
