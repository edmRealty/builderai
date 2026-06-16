import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptEnvelopeV1 } from "@/lib/backup";

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "OWNER"].includes(user.role)) return new Response("Unauthorized", { status: 401 });

  let passphrase = "";
  let encrypted = true;
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      passphrase = String(body?.passphrase ?? "");
      encrypted = body?.encrypted !== false;
    } else {
      const fd = await req.formData();
      passphrase = String(fd.get("passphrase") ?? "");
      encrypted = String(fd.get("encrypted") ?? "true") !== "false";
    }
  } catch {
    // ignore
  }

  if (encrypted && passphrase.length < 8) {
    return jsonResponse({ error: "Passphrase must be at least 8 characters (or disable encryption)." }, 400);
  }

  // Export org-scoped data only. Sessions/MFA challenges are intentionally excluded.
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  if (!org) return jsonResponse({ error: "Organization not found." }, 404);

  const [
    users,
    llcs,
    qbConnections,
    projects,
    assignments,
    vendors,
    commitments,
    vendorCommunications,
    expectedInvoices,
    vendorInvoiceRequests,
    vendorInvoiceUploads,
    banks,
    bankCommunications,
    templates,
    loans,
    loanBankers,
    draws,
    drawLineItems,
    permits,
    abatements,
    planSets,
    inspections,
    updates,
    units,
    partners,
    projectPartners,
    photos,
    customSections,
    customSectionItems,
    reminders,
    notifications,
    reportSchedules,
    auditEvents,
    qbTxns,
    integrationEvents,
    qbdInstructions,
    orgTodos,
    identifierDefinitions,
    projectIdentifiers,
    llcDocuments,
    llcPartners
  ] = await Promise.all([
    prisma.user.findMany({ where: { orgId: user.orgId } }),
    prisma.lLC.findMany({ where: { orgId: user.orgId } }),
    prisma.quickBooksConnection.findMany({ where: { orgId: user.orgId } }),
    prisma.project.findMany({ where: { orgId: user.orgId } }),
    prisma.projectAssignment.findMany({ where: { orgId: user.orgId } }),
    prisma.vendor.findMany({ where: { orgId: user.orgId } }),
    prisma.commitment.findMany({ where: { orgId: user.orgId } }),
    prisma.vendorCommunication.findMany({ where: { orgId: user.orgId } }),
    prisma.expectedInvoice.findMany({ where: { orgId: user.orgId } }),
    prisma.vendorInvoiceRequest.findMany({ where: { orgId: user.orgId } }),
    prisma.vendorInvoiceUpload.findMany({ where: { orgId: user.orgId } }),
    prisma.bank.findMany({ where: { orgId: user.orgId } }),
    prisma.bankCommunication.findMany({ where: { orgId: user.orgId } }),
    prisma.drawTemplate.findMany({ where: { orgId: user.orgId } }),
    prisma.loan.findMany({ where: { orgId: user.orgId } }),
    prisma.loanBanker.findMany({ where: { orgId: user.orgId } }),
    prisma.drawRequest.findMany({ where: { orgId: user.orgId } }),
    prisma.drawLineItem.findMany({ where: { orgId: user.orgId } }),
    prisma.permit.findMany({ where: { orgId: user.orgId } }),
    prisma.abatement.findMany({ where: { orgId: user.orgId } }),
    prisma.planSet.findMany({ where: { orgId: user.orgId } }),
    prisma.inspection.findMany({ where: { orgId: user.orgId } }),
    prisma.projectUpdate.findMany({ where: { orgId: user.orgId } }),
    prisma.unit.findMany({ where: { orgId: user.orgId } }),
    prisma.partner.findMany({ where: { orgId: user.orgId } }),
    prisma.projectPartner.findMany({ where: { orgId: user.orgId } }),
    prisma.projectPhoto.findMany({ where: { orgId: user.orgId } }),
    prisma.projectCustomSection.findMany({ where: { orgId: user.orgId } }),
    prisma.projectCustomSectionItem.findMany({ where: { orgId: user.orgId } }),
    prisma.reminder.findMany({ where: { orgId: user.orgId } }),
    prisma.notification.findMany({ where: { orgId: user.orgId } }),
    prisma.reportSchedule.findMany({ where: { orgId: user.orgId } }),
    prisma.auditEvent.findMany({ where: { orgId: user.orgId } }),
    prisma.quickBooksTxn.findMany({ where: { orgId: user.orgId } }),
    prisma.integrationEvent.findMany({ where: { orgId: user.orgId } }),
    prisma.qbdInstruction.findMany({ where: { orgId: user.orgId } }),
    prisma.orgTodo.findMany({ where: { orgId: user.orgId } }),
    prisma.identifierDefinition.findMany({ where: { orgId: user.orgId } }),
    prisma.projectIdentifier.findMany({ where: { orgId: user.orgId } }),
    prisma.llcDocument.findMany({ where: { orgId: user.orgId } }),
    prisma.llcPartner.findMany({ where: { orgId: user.orgId } })
  ]);

  const exportedAt = new Date().toISOString();
  const appVersion = "0.1.0";
  const payload = {
    exportedAt,
    appVersion,
    org: {
      organization: org,
      users,
      llcs,
      qbConnections,
      projects,
      assignments,
      vendors,
      commitments,
      vendorCommunications,
      expectedInvoices,
      vendorInvoiceRequests,
      vendorInvoiceUploads,
      banks,
      bankCommunications,
      templates,
      loans,
      loanBankers,
      draws,
      drawLineItems,
      permits,
      abatements,
      planSets,
      inspections,
      updates,
      units,
      partners,
      projectPartners,
      photos,
      customSections,
      customSectionItems,
      reminders,
      notifications,
      reportSchedules,
      auditEvents,
      qbTxns,
      integrationEvents,
      qbdInstructions,
      orgTodos,
      identifierDefinitions,
      projectIdentifiers,
      llcDocuments,
      llcPartners
    }
  };

  const envelope = encrypted
    ? encryptEnvelopeV1({ passphrase, exportedAt, appVersion, payload })
    : ({ format: "mfcms-backup", version: 1, encrypted: false, exportedAt, appVersion, payload } as const);

  const filenameDate = exportedAt.slice(0, 10);
  const filename = `mfcms_backup_${filenameDate}.mfcmsbackup`;

  return new Response(JSON.stringify(envelope), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename=\"${filename}\"`
    }
  });
}
