import xlsx from "node-xlsx";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectScopeWhere } from "@/lib/scope";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role === "FIELD_AGENT") return new Response("Forbidden", { status: 403 });

  const projectWhere = projectScopeWhere(user);
  const now = new Date();
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [permits, abatements] = await Promise.all([
    prisma.permit.findMany({
      where: { project: projectWhere, expiresAt: { gte: now, lte: in30 } },
      include: { project: true },
      orderBy: { expiresAt: "asc" },
      take: 5000
    }),
    prisma.abatement.findMany({
      where: { project: projectWhere, termEnd: { gte: now, lte: in30 } },
      include: { project: true },
      orderBy: { termEnd: "asc" },
      take: 5000
    })
  ]);

  const permitCols = ["Project", "PermitType", "Jurisdiction", "PermitNumber", "Status", "IssuedAt", "ExpiresAt", "Notes"];
  const permitRows = permits.map((p) => [
    p.project.name,
    p.permitType,
    p.jurisdiction,
    p.permitNumber ?? "",
    p.status,
    p.issuedAt ? p.issuedAt.toISOString().slice(0, 10) : "",
    p.expiresAt ? p.expiresAt.toISOString().slice(0, 10) : "",
    p.notes ?? ""
  ]);

  const abatementCols = ["Project", "Program", "Status", "TermStart", "TermEnd", "Notes"];
  const abatementRows = abatements.map((a) => [
    a.project.name,
    a.programName,
    a.status,
    a.termStart ? a.termStart.toISOString().slice(0, 10) : "",
    a.termEnd ? a.termEnd.toISOString().slice(0, 10) : "",
    a.notes ?? ""
  ]);

  const buffer = xlsx.build([
    { name: "Permits_30d", data: [permitCols, ...permitRows], options: {} },
    { name: "Abatements_30d", data: [abatementCols, ...abatementRows], options: {} }
  ]);

  const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const today = new Date().toISOString().slice(0, 10);
  return new Response(body as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"mfcms_permit_abatement_expirations_${today}.xlsx\"`
    }
  });
}

