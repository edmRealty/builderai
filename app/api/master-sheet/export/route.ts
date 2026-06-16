import xlsx from "node-xlsx";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptString } from "@/lib/crypto";

const COLUMNS = [
  "ProjectId",
  "ProjectName",
  "AddressLine1",
  "AddressLine2",
  "City",
  "State",
  "Zip",
  "UnitCount",
  "Status",
  "CityNumber",
  "LLCName",
  "LLCLegalName",
  "EIN",
  "PATaxNumber",
  "QBConnectionId",
  "QBConnectionDisplayName"
];

function safeDecrypt(value: string | null) {
  if (!value) return "";
  try {
    return decryptString(value);
  } catch {
    return "";
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "OWNER"].includes(user.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { orgId: user.orgId },
    include: { llc: true, qbConnection: true },
    orderBy: { createdAt: "asc" }
  });

  const rows = projects.map((p) => [
    p.id,
    p.name,
    p.addressLine1,
    p.addressLine2 ?? "",
    p.city,
    p.state,
    p.zip,
    p.unitCount ?? "",
    p.status,
    p.cityNumber ?? "",
    p.llc.name,
    p.llc.legalName ?? "",
    safeDecrypt(p.llc.einEnc),
    safeDecrypt(p.llc.paTaxNumberEnc),
    p.qbConnectionId,
    p.qbConnection.displayName
  ]);

  const colWidths = COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 2) }));
  const sheetOptions = { "!cols": colWidths };

  const buffer = xlsx.build([{ name: "Projects", data: [COLUMNS, ...rows], options: sheetOptions }]);
  const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const today = new Date().toISOString().slice(0, 10);
  return new Response(body as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mfcms_master_export_${today}.xlsx"`
    }
  });
}
