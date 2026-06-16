"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { decryptEnvelopeV1, type BackupEnvelopeV1 } from "@/lib/backup";
import { auditEvent } from "@/lib/audit";

const restoreSchema = z.object({
  passphrase: z.string().optional().or(z.literal("")),
  mode: z.enum(["merge", "replace"]).default("replace")
});

function parseJsonFile(file: File) {
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("Missing backup file");
  return file.arrayBuffer().then((buf) => JSON.parse(Buffer.from(buf).toString("utf8")) as BackupEnvelopeV1);
}

export async function restoreFromBackup(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER"].includes(user.role)) redirect("/app/dashboard");

  const parsed = restoreSchema.parse({
    passphrase: formData.get("passphrase")?.toString() ?? "",
    mode: formData.get("mode")?.toString() ?? "replace"
  });

  const file = formData.get("backupFile");
  if (!(file instanceof File)) redirect("/app/master-sheet?restoreError=Missing%20backup%20file");

  let envelope: BackupEnvelopeV1;
  try {
    envelope = await parseJsonFile(file);
  } catch {
    redirect("/app/master-sheet?restoreError=Invalid%20backup%20file");
  }

  let payload: any;
  try {
    payload = decryptEnvelopeV1(envelope, parsed.passphrase || undefined) as any;
  } catch {
    redirect("/app/master-sheet?restoreError=Unable%20to%20decrypt%20backup%20(check%20passphrase)");
  }

  if (!payload?.org?.organization?.id) redirect("/app/master-sheet?restoreError=Backup%20missing%20organization");
  if (payload.org.organization.id !== user.orgId) {
    redirect("/app/master-sheet?restoreError=Backup%20organization%20does%20not%20match%20current%20org");
  }

  const orgId = user.orgId;
  const data = payload.org;

  // Restore order matters due to foreign keys.
  const restore = async () => {
    if (parsed.mode === "replace") {
      // Delete org-scoped data (best-effort in dependency order).
      await prisma.notification.deleteMany({ where: { orgId } });
      await prisma.auditEvent.deleteMany({ where: { orgId } });
      await prisma.reportSchedule.deleteMany({ where: { orgId } });
      await prisma.reminder.deleteMany({ where: { orgId } });
      await prisma.orgTodo.deleteMany({ where: { orgId } });

      await prisma.projectIdentifier.deleteMany({ where: { orgId } });
      await prisma.identifierDefinition.deleteMany({ where: { orgId } });

      await prisma.vendorCommunication.deleteMany({ where: { orgId } });
      await prisma.bankCommunication.deleteMany({ where: { orgId } });

      await prisma.vendorInvoiceUpload.deleteMany({ where: { orgId } });
      await prisma.vendorInvoiceRequest.deleteMany({ where: { orgId } });
      await prisma.expectedInvoice.deleteMany({ where: { orgId } });

      await prisma.drawLineItem.deleteMany({ where: { orgId } });
      await prisma.drawRequest.deleteMany({ where: { orgId } });
      await prisma.loanBanker.deleteMany({ where: { orgId } });
      await prisma.loan.deleteMany({ where: { orgId } });
      await prisma.drawTemplate.deleteMany({ where: { orgId } });
      await prisma.bank.deleteMany({ where: { orgId } });

      await prisma.projectPhoto.deleteMany({ where: { orgId } });
      await prisma.projectUpdate.deleteMany({ where: { orgId } });
      await prisma.inspection.deleteMany({ where: { orgId } });
      await prisma.planSet.deleteMany({ where: { orgId } });
      await prisma.abatement.deleteMany({ where: { orgId } });
      await prisma.permit.deleteMany({ where: { orgId } });
      await prisma.document.deleteMany({ where: { orgId } });
      await prisma.unit.deleteMany({ where: { orgId } });
      await prisma.projectPartner.deleteMany({ where: { orgId } });
      await prisma.partner.deleteMany({ where: { orgId } });
      await prisma.projectAssignment.deleteMany({ where: { orgId } });
      await prisma.commitment.deleteMany({ where: { orgId } });
      await prisma.vendor.deleteMany({ where: { orgId } });

      await prisma.qbdInstruction.deleteMany({ where: { orgId } });
      await prisma.integrationEvent.deleteMany({ where: { orgId } });
      await prisma.quickBooksTxn.deleteMany({ where: { orgId } });

      await prisma.projectCustomSectionItem.deleteMany({ where: { orgId } });
      await prisma.projectCustomSection.deleteMany({ where: { orgId } });
      await prisma.projectPhoto.deleteMany({ where: { orgId } });

      await prisma.project.deleteMany({ where: { orgId } });
      await prisma.quickBooksConnection.deleteMany({ where: { orgId } });

      await prisma.llcDocument.deleteMany({ where: { orgId } });
      await prisma.llcPartner.deleteMany({ where: { orgId } });
      await prisma.lLC.deleteMany({ where: { orgId } });

      // Users: keep current user, then upsert everything else (including current user record).
      // (Sessions/MFA challenges are intentionally not restored.)
    }

    // Upsert organization basics
    await prisma.organization.update({
      where: { id: orgId },
      data: { name: data.organization.name }
    });

    // Users (upsert by id)
    for (const u of data.users ?? []) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: { ...u },
        create: { ...u }
      });
    }

    for (const l of data.llcs ?? []) await prisma.lLC.upsert({ where: { id: l.id }, update: { ...l }, create: { ...l } });
    for (const c of data.qbConnections ?? []) await prisma.quickBooksConnection.upsert({ where: { id: c.id }, update: { ...c }, create: { ...c } });
    for (const p of data.projects ?? []) await prisma.project.upsert({ where: { id: p.id }, update: { ...p }, create: { ...p } });
    for (const a of data.assignments ?? []) await prisma.projectAssignment.upsert({ where: { id: a.id }, update: { ...a }, create: { ...a } });
    for (const v of data.vendors ?? []) await prisma.vendor.upsert({ where: { id: v.id }, update: { ...v }, create: { ...v } });
    for (const c of data.commitments ?? []) await prisma.commitment.upsert({ where: { id: c.id }, update: { ...c }, create: { ...c } });
    for (const c of data.vendorCommunications ?? []) await prisma.vendorCommunication.upsert({ where: { id: c.id }, update: { ...c }, create: { ...c } });

    for (const ei of data.expectedInvoices ?? []) await prisma.expectedInvoice.upsert({ where: { id: ei.id }, update: { ...ei }, create: { ...ei } });
    for (const r of data.vendorInvoiceRequests ?? []) await prisma.vendorInvoiceRequest.upsert({ where: { id: r.id }, update: { ...r }, create: { ...r } });
    for (const u of data.vendorInvoiceUploads ?? []) await prisma.vendorInvoiceUpload.upsert({ where: { id: u.id }, update: { ...u }, create: { ...u } });

    for (const b of data.banks ?? []) await prisma.bank.upsert({ where: { id: b.id }, update: { ...b }, create: { ...b } });
    for (const c of data.bankCommunications ?? []) await prisma.bankCommunication.upsert({ where: { id: c.id }, update: { ...c }, create: { ...c } });
    for (const t of data.templates ?? []) await prisma.drawTemplate.upsert({ where: { id: t.id }, update: { ...t }, create: { ...t } });
    for (const l of data.loans ?? []) await prisma.loan.upsert({ where: { id: l.id }, update: { ...l }, create: { ...l } });
    for (const lb of data.loanBankers ?? []) await prisma.loanBanker.upsert({ where: { id: lb.id }, update: { ...lb }, create: { ...lb } });
    for (const d of data.draws ?? []) await prisma.drawRequest.upsert({ where: { id: d.id }, update: { ...d }, create: { ...d } });
    for (const li of data.drawLineItems ?? []) await prisma.drawLineItem.upsert({ where: { id: li.id }, update: { ...li }, create: { ...li } });

    for (const p of data.permits ?? []) await prisma.permit.upsert({ where: { id: p.id }, update: { ...p }, create: { ...p } });
    for (const a of data.abatements ?? []) await prisma.abatement.upsert({ where: { id: a.id }, update: { ...a }, create: { ...a } });
    for (const ps of data.planSets ?? []) await prisma.planSet.upsert({ where: { id: ps.id }, update: { ...ps }, create: { ...ps } });
    for (const i of data.inspections ?? []) await prisma.inspection.upsert({ where: { id: i.id }, update: { ...i }, create: { ...i } });
    for (const u of data.updates ?? []) await prisma.projectUpdate.upsert({ where: { id: u.id }, update: { ...u }, create: { ...u } });
    for (const u of data.units ?? []) await prisma.unit.upsert({ where: { id: u.id }, update: { ...u }, create: { ...u } });

    for (const p of data.partners ?? []) await prisma.partner.upsert({ where: { id: p.id }, update: { ...p }, create: { ...p } });
    for (const pp of data.projectPartners ?? []) await prisma.projectPartner.upsert({ where: { id: pp.id }, update: { ...pp }, create: { ...pp } });

    for (const ph of data.photos ?? []) await prisma.projectPhoto.upsert({ where: { id: ph.id }, update: { ...ph }, create: { ...ph } });
    for (const cs of data.customSections ?? []) await prisma.projectCustomSection.upsert({ where: { id: cs.id }, update: { ...cs }, create: { ...cs } });
    for (const it of data.customSectionItems ?? []) await prisma.projectCustomSectionItem.upsert({ where: { id: it.id }, update: { ...it }, create: { ...it } });

    for (const r of data.reminders ?? []) await prisma.reminder.upsert({ where: { id: r.id }, update: { ...r }, create: { ...r } });
    for (const n of data.notifications ?? []) await prisma.notification.upsert({ where: { id: n.id }, update: { ...n }, create: { ...n } });
    for (const rs of data.reportSchedules ?? []) await prisma.reportSchedule.upsert({ where: { id: rs.id }, update: { ...rs }, create: { ...rs } });
    for (const ae of data.auditEvents ?? []) await prisma.auditEvent.upsert({ where: { id: ae.id }, update: { ...ae }, create: { ...ae } });

    for (const q of data.qbTxns ?? []) await prisma.quickBooksTxn.upsert({ where: { id: q.id }, update: { ...q }, create: { ...q } });
    for (const e of data.integrationEvents ?? []) await prisma.integrationEvent.upsert({ where: { id: e.id }, update: { ...e }, create: { ...e } });
    for (const ins of data.qbdInstructions ?? []) await prisma.qbdInstruction.upsert({ where: { id: ins.id }, update: { ...ins }, create: { ...ins } });

    for (const t of data.orgTodos ?? []) await prisma.orgTodo.upsert({ where: { id: t.id }, update: { ...t }, create: { ...t } });
    for (const d of data.identifierDefinitions ?? []) await prisma.identifierDefinition.upsert({ where: { id: d.id }, update: { ...d }, create: { ...d } });
    for (const pi of data.projectIdentifiers ?? []) await prisma.projectIdentifier.upsert({ where: { id: pi.id }, update: { ...pi }, create: { ...pi } });
    for (const d of data.llcDocuments ?? []) await prisma.llcDocument.upsert({ where: { id: d.id }, update: { ...d }, create: { ...d } });
    for (const lp of data.llcPartners ?? []) await prisma.llcPartner.upsert({ where: { id: lp.id }, update: { ...lp }, create: { ...lp } });
  };

  await prisma.$transaction(async () => {
    await restore();
  }, { timeout: 600000 });

  await auditEvent({
    orgId,
    userId: user.id,
    action: "BACKUP_RESTORED",
    entityType: "Organization",
    entityId: orgId,
    data: { mode: parsed.mode, exportedAt: payload.exportedAt }
  });

  redirect("/app/dashboard");
}
