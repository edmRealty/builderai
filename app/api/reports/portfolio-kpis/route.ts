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
  const now = new Date();
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const projectIds = (
    await prisma.project.findMany({
      where: projectWhere,
      select: { id: true },
      take: 10000
    })
  ).map((p) => p.id);

  const [projectCount, commitmentAgg, openCommitments, drawPipeline, expiringPermitsCount, expectedInvoiceCount, unmatchedQbCount] = await Promise.all([
    prisma.project.count({ where: projectWhere }),
    prisma.commitment.aggregate({
      where: { project: projectWhere },
      _sum: { agreedCents: true, paidToDateCents: true }
    }),
    prisma.commitment.count({
      where: { project: projectWhere, status: { notIn: ["PAID"] } }
    }),
    prisma.drawRequest.groupBy({
      by: ["status"],
      where: { project: projectWhere },
      _count: { _all: true }
    }),
    prisma.permit.count({
      where: { project: projectWhere, expiresAt: { gte: now, lte: in30 } }
    }),
    prisma.expectedInvoice.count({
      where: { commitment: { project: projectWhere }, resolvedAt: null }
    }),
    prisma.quickBooksTxn.count({
      where: {
        orgId: user.orgId,
        commitmentId: null,
        OR: [
          { projectId: null },
          { projectId: { in: projectIds } }
        ]
      }
    })
  ]);

  const agreed = commitmentAgg._sum.agreedCents ?? 0;
  const paid = commitmentAgg._sum.paidToDateCents ?? 0;
  const paidPct = agreed > 0 ? paid / agreed : 0;

  const pipelineMap = new Map(drawPipeline.map((d) => [d.status, d._count._all]));

  const kpiRows = [
    ["Projects", projectCount],
    ["Total committed (agreed)", formatMoney(agreed)],
    ["Paid to date", formatMoney(paid)],
    ["Paid %", `${(paidPct * 100).toFixed(1)}%`],
    ["Open commitments (not PAID)", openCommitments],
    ["Draws: Draft", pipelineMap.get("DRAFT") ?? 0],
    ["Draws: Ready for banker", pipelineMap.get("READY_FOR_BANK_REVIEW") ?? 0],
    ["Draws: Approved (not funded)", pipelineMap.get("APPROVED") ?? 0],
    ["Draws: Funded", pipelineMap.get("FUNDED") ?? 0],
    ["Alerts: Permits expiring (30d)", expiringPermitsCount],
    ["Alerts: Expected invoices (open)", expectedInvoiceCount],
    ["Exceptions: Unmatched QB txns", unmatchedQbCount]
  ];

  const buffer = xlsx.build([{ name: "Portfolio_KPIs", data: [["Metric", "Value"], ...kpiRows], options: {} }]);
  const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const today = new Date().toISOString().slice(0, 10);
  return new Response(body as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"mfcms_portfolio_kpis_${today}.xlsx\"`
    }
  });
}
