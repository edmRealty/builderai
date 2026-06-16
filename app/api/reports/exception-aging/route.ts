import xlsx from "node-xlsx";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectScopeWhere } from "@/lib/scope";
import { formatMoney } from "@/lib/format";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role === "FIELD_AGENT") return new Response("Forbidden", { status: 403 });

  const projectWhere = projectScopeWhere(user);
  const projectIds = (
    await prisma.project.findMany({ where: projectWhere, select: { id: true, name: true }, take: 10000 })
  );
  const projectIdSet = new Set(projectIds.map((p) => p.id));
  const projectNameById = new Map(projectIds.map((p) => [p.id, p.name]));

  const [unmatchedQb, expectedInvoices] = await Promise.all([
    prisma.quickBooksTxn.findMany({
      where: {
        orgId: user.orgId,
        commitmentId: null,
        OR: [{ projectId: null }, { projectId: { in: [...projectIdSet] } }]
      },
      orderBy: { updatedAt: "desc" },
      take: 2000
    }),
    prisma.expectedInvoice.findMany({
      where: { orgId: user.orgId, resolvedAt: null, commitment: { project: projectWhere } },
      include: { commitment: { include: { project: true, vendor: true } } },
      orderBy: { createdAt: "desc" },
      take: 2000
    })
  ]);

  const unmatchedCols = ["QBConnectionId", "EntityType", "EntityId", "Amount", "TxnDate", "Project", "VendorId", "CreatedAt"];
  const unmatchedRows = unmatchedQb.map((t) => [
    t.qbConnectionId,
    t.qbEntityType,
    t.qbEntityId,
    formatMoney(t.amountCents),
    t.txnDate ? t.txnDate.toISOString().slice(0, 10) : "",
    t.projectId ? (projectNameById.get(t.projectId) ?? t.projectId) : "",
    t.vendorId ?? "",
    t.createdAt.toISOString()
  ]);

  const expectedCols = ["Project", "Vendor", "CommitmentCode", "Scope", "CompletedAt", "ExpectedSince"];
  const expectedRows = expectedInvoices.map((e) => [
    e.commitment.project.name,
    e.commitment.vendor.name,
    e.commitment.code,
    e.commitment.scope,
    e.commitment.completedAt ? e.commitment.completedAt.toISOString().slice(0, 10) : "",
    e.createdAt.toISOString().slice(0, 10)
  ]);

  const lienCols = ["Note"];
  const lienRows = [["Lien waiver tracking is wired in Phase 2 (document uploads + requirements per bank template)."]];

  const buffer = xlsx.build([
    { name: "Unmatched_QB", data: [unmatchedCols, ...unmatchedRows], options: {} },
    { name: "Expected_Invoices", data: [expectedCols, ...expectedRows], options: {} },
    { name: "Missing_LienWaivers", data: [lienCols, ...lienRows], options: {} }
  ]);

  const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const today = new Date().toISOString().slice(0, 10);
  return new Response(body as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"mfcms_exception_aging_${today}.xlsx\"`
    }
  });
}

