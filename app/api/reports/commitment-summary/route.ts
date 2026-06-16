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

  const commitments = await prisma.commitment.findMany({
    where: { project: projectWhere },
    include: { project: true, vendor: true },
    orderBy: { updatedAt: "desc" },
    take: 5000
  });

  const columns = ["Project", "Vendor", "CommitmentCode", "Scope", "CostCode", "Agreed", "PaidToDate", "PaidPct", "Status"];
  const rows = commitments.map((c) => {
    const paidPct = c.agreedCents > 0 ? c.paidToDateCents / c.agreedCents : 0;
    return [
      c.project.name,
      c.vendor.name,
      c.code,
      c.scope,
      c.costCode,
      formatMoney(c.agreedCents),
      formatMoney(c.paidToDateCents),
      `${(paidPct * 100).toFixed(1)}%`,
      c.status
    ];
  });

  const colWidths = columns.map((c) => ({ wch: Math.max(12, c.length + 2) }));
  const sheetOptions = { "!cols": colWidths };

  const buffer = xlsx.build([{ name: "Commitments", data: [columns, ...rows], options: sheetOptions }]);
  const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const today = new Date().toISOString().slice(0, 10);
  return new Response(body as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"mfcms_commitment_summary_${today}.xlsx\"`
    }
  });
}

