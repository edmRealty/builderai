import xlsx from "node-xlsx";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectScopeWhere } from "@/lib/scope";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role === "FIELD_AGENT") return new Response("Forbidden", { status: 403 });

  const projectWhere = projectScopeWhere(user);

  const [pipeline, draws] = await Promise.all([
    prisma.drawRequest.groupBy({
      by: ["status"],
      where: { project: projectWhere },
      _count: { _all: true }
    }),
    prisma.drawRequest.findMany({
      where: { project: projectWhere },
      include: { project: true, loan: { include: { bank: true } }, template: true },
      orderBy: { updatedAt: "desc" },
      take: 2000
    })
  ]);

  const summaryCols = ["Status", "Count"];
  const summaryRows = pipeline
    .sort((a, b) => a.status.localeCompare(b.status))
    .map((p) => [p.status, p._count._all]);

  const drawCols = ["Project", "Bank", "Loan", "Template", "Status", "ApprovedAt", "FundedAt", "UpdatedAt"];
  const drawRows = draws.map((d) => [
    d.project.name,
    d.loan.bank.name,
    d.loan.name,
    `${d.template.name} v${d.template.version}`,
    d.status,
    d.approvedAt ? d.approvedAt.toISOString() : "",
    d.fundedAt ? d.fundedAt.toISOString() : "",
    d.updatedAt.toISOString()
  ]);

  const buffer = xlsx.build([
    { name: "Summary", data: [summaryCols, ...summaryRows], options: {} },
    { name: "Draws", data: [drawCols, ...drawRows], options: {} }
  ]);
  const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const today = new Date().toISOString().slice(0, 10);
  return new Response(body as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"mfcms_draw_pipeline_${today}.xlsx\"`
    }
  });
}

