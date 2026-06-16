import xlsx from "node-xlsx";

import { getCurrentUser } from "@/lib/auth";

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

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "OWNER"].includes(user.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sampleRow = [
    "",
    "Example Project",
    "123 Main St",
    "",
    "Philadelphia",
    "PA",
    "19103",
    12,
    "UNDER_CONSTRUCTION",
    "City-12345",
    "123 Main St LLC",
    "123 Main Street LLC",
    "12-3456789",
    "PA-ACCOUNT-0001",
    "",
    "Unassigned"
  ];

  const readme = [
    ["Sheet", "Projects"],
    ["Required", "ProjectName, AddressLine1, City, State, Zip, LLCName"],
    ["Updates", "If ProjectId is provided and matches, the row updates that project."],
    ["Matching", "If no ProjectId: match by LLCName + AddressLine1 + Zip."],
    ["Status", "LOT_ACQUIRED | PLANNING | UNDER_CONSTRUCTION | COMPLETED_FOR_SALE | COMPLETED_FOR_RENT"],
    [
      "QB connection",
      "Optional. If omitted, the importer uses the first connection for that LLC or creates an Unassigned placeholder."
    ],
    ["Sensitive fields", "EIN and PATaxNumber are stored encrypted in the database."],
    ["Notes", "Delete the sample row before real use."]
  ];

  const colWidths = COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 2) }));
  const projectsSheetOptions = { "!cols": colWidths };

  const buffer = xlsx.build([
    { name: "Projects", data: [COLUMNS, sampleRow], options: projectsSheetOptions },
    { name: "README", data: readme, options: {} }
  ]);
  const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  return new Response(body as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="mfcms_master_template.xlsx"'
    }
  });
}
