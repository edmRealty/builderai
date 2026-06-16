"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { auditEvent } from "@/lib/audit";

const createSchema = z.object({
  reportType: z.enum([
    "PORTFOLIO_KPIS",
    "COMMITMENT_SUMMARY",
    "DRAW_PIPELINE",
    "EXCEPTION_AGING",
    "PERMIT_ABATEMENT_EXPIRATIONS"
  ]),
  cadence: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  recipients: z.string().min(3)
});

export async function createReportSchedule(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = createSchema.parse({
    reportType: formData.get("reportType"),
    cadence: formData.get("cadence"),
    recipients: formData.get("recipients")
  });

  const recipients = data.recipients
    .split(/[,\\n]/g)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (recipients.length === 0) redirect("/app/reports");

  const schedule = await prisma.reportSchedule.create({
    data: {
      orgId: user.orgId,
      createdByUserId: user.id,
      reportType: data.reportType,
      cadence: data.cadence,
      recipients,
      active: true
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "REPORT_SCHEDULE_CREATED",
    entityType: "ReportSchedule",
    entityId: schedule.id,
    data: { reportType: schedule.reportType, cadence: schedule.cadence, recipients: schedule.recipients }
  });

  redirect("/app/reports");
}

const toggleSchema = z.object({
  scheduleId: z.string().min(1)
});

export async function toggleReportSchedule(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = toggleSchema.parse({
    scheduleId: formData.get("scheduleId")
  });

  const schedule = await prisma.reportSchedule.findUnique({ where: { id: data.scheduleId } });
  if (!schedule || schedule.orgId !== user.orgId) redirect("/app/reports");

  const updated = await prisma.reportSchedule.update({
    where: { id: schedule.id },
    data: { active: !schedule.active }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: updated.active ? "REPORT_SCHEDULE_ENABLED" : "REPORT_SCHEDULE_DISABLED",
    entityType: "ReportSchedule",
    entityId: updated.id
  });

  redirect("/app/reports");
}

