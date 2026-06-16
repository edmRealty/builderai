"use server";

import xlsx from "node-xlsx";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { encryptString } from "@/lib/crypto";
import { auditEvent } from "@/lib/audit";

function normalizeHeader(input: unknown) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getCell(row: any[], headerToIndex: Map<string, number>, key: string) {
  const idx = headerToIndex.get(key);
  if (idx === undefined) return "";
  const value = row[idx];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseOptionalInt(value: string) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseProjectStatus(raw: string) {
  const v = normalizeHeader(raw);
  if (v === "lotacquired" || v === "acquired") return "LOT_ACQUIRED" as const;
  if (v === "planning") return "PLANNING" as const;
  if (v === "underconstruction" || v === "construction") return "UNDER_CONSTRUCTION" as const;
  if (v === "completedforsale" || v === "completed" || v === "forsale") return "COMPLETED_FOR_SALE" as const;
  if (v === "completedforrent" || v === "rentalready" || v === "rental" || v === "forrent") return "COMPLETED_FOR_RENT" as const;
  return null;
}

export type MasterImportResult =
  | { ok: true; createdProjects: number; updatedProjects: number; createdLlcs: number; updatedLlcs: number; errors: { row: number; message: string }[] }
  | { ok: false; error: string };

export async function importMasterSpreadsheet(formData: FormData): Promise<MasterImportResult> {
  const user = await requireUser();
  if (!(["ADMIN", "OWNER"].includes(user.role))) redirect("/app/dashboard");

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Please choose an .xlsx file." };
  if (file.size === 0) return { ok: false, error: "File is empty." };

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const sheets = xlsx.parse(buffer);
  const sheet =
    sheets.find((s) => normalizeHeader(s.name) === "projects") ??
    sheets[0];

  if (!sheet || !Array.isArray(sheet.data) || sheet.data.length < 2) {
    return { ok: false, error: "Workbook must have a Projects sheet with a header row and at least one data row." };
  }

  const headerRow = sheet.data[0] as any[];
  const headerToIndex = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const key = normalizeHeader(headerRow[i]);
    if (key) headerToIndex.set(key, i);
  }

  // Supported headers (normalized):
  // projectid, projectname, addressline1, addressline2, city, state, zip, unitcount, status, citynumber,
  // llcname, llclegalname, ein, pataxnumber, qbconnectionid, qbconnectiondisplayname

  const errors: { row: number; message: string }[] = [];
  let createdProjects = 0;
  let updatedProjects = 0;
  let createdLlcs = 0;
  let updatedLlcs = 0;

  for (let r = 1; r < sheet.data.length; r++) {
    const row = sheet.data[r] as any[];
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;

    const rowNumber = r + 1; // 1-based in Excel

    try {
      const projectId = getCell(row, headerToIndex, "projectid");
      const projectName = getCell(row, headerToIndex, "projectname") || getCell(row, headerToIndex, "name");
      const addressLine1 = getCell(row, headerToIndex, "addressline1");
      const addressLine2 = getCell(row, headerToIndex, "addressline2");
      const city = getCell(row, headerToIndex, "city");
      const state = getCell(row, headerToIndex, "state");
      const zip = getCell(row, headerToIndex, "zip");
      const unitCount = parseOptionalInt(getCell(row, headerToIndex, "unitcount"));
      const statusRaw = getCell(row, headerToIndex, "status");
      const cityNumber = getCell(row, headerToIndex, "citynumber");

      const llcName = getCell(row, headerToIndex, "llcname");
      const llcLegalName = getCell(row, headerToIndex, "llclegalname");
      const ein = getCell(row, headerToIndex, "ein");
      const paTaxNumber = getCell(row, headerToIndex, "pataxnumber");

      const qbConnectionId = getCell(row, headerToIndex, "qbconnectionid");
      const qbConnectionDisplayName = getCell(row, headerToIndex, "qbconnectiondisplayname");

      if (!projectName) throw new Error("Missing ProjectName");
      if (!addressLine1) throw new Error("Missing AddressLine1");
      if (!city) throw new Error("Missing City");
      if (!state) throw new Error("Missing State");
      if (!zip) throw new Error("Missing Zip");
      if (!llcName) throw new Error("Missing LLCName");

      const status = parseProjectStatus(statusRaw);

      const llcExisting = await prisma.lLC.findFirst({
        where: { orgId: user.orgId, name: { equals: llcName, mode: "insensitive" } }
      });

      const llc = llcExisting
        ? await prisma.lLC.update({
            where: { id: llcExisting.id },
            data: {
              legalName: llcLegalName || llcExisting.legalName,
              einEnc: ein ? encryptString(ein) : llcExisting.einEnc,
              paTaxNumberEnc: paTaxNumber ? encryptString(paTaxNumber) : llcExisting.paTaxNumberEnc
            }
          })
        : await prisma.lLC.create({
            data: {
              orgId: user.orgId,
              name: llcName,
              legalName: llcLegalName || null,
              einEnc: ein ? encryptString(ein) : null,
              paTaxNumberEnc: paTaxNumber ? encryptString(paTaxNumber) : null
            }
          });

      if (llcExisting) updatedLlcs++;
      else createdLlcs++;

      let qbConnection = null as null | { id: string };

      if (qbConnectionId) {
        const conn = await prisma.quickBooksConnection.findFirst({
          where: { id: qbConnectionId, orgId: user.orgId }
        });
        if (!conn) throw new Error(`QBConnectionId not found: ${qbConnectionId}`);
        qbConnection = { id: conn.id };
      } else if (qbConnectionDisplayName) {
        const conn = await prisma.quickBooksConnection.findFirst({
          where: {
            orgId: user.orgId,
            llcId: llc.id,
            displayName: { equals: qbConnectionDisplayName, mode: "insensitive" }
          }
        });
        if (conn) qbConnection = { id: conn.id };
      }

      if (!qbConnection) {
        const conn = await prisma.quickBooksConnection.findFirst({
          where: { orgId: user.orgId, llcId: llc.id },
          orderBy: { createdAt: "asc" }
        });
        if (conn) qbConnection = { id: conn.id };
      }

      if (!qbConnection) {
        const created = await prisma.quickBooksConnection.create({
          data: {
            orgId: user.orgId,
            llcId: llc.id,
            type: "QBO",
            status: "DISABLED",
            displayName: qbConnectionDisplayName || "Unassigned"
          }
        });
        qbConnection = { id: created.id };
      }

      const projectExisting = projectId
        ? await prisma.project.findFirst({ where: { id: projectId, orgId: user.orgId } })
        : await prisma.project.findFirst({
            where: {
              orgId: user.orgId,
              addressLine1: { equals: addressLine1, mode: "insensitive" },
              zip,
              llcId: llc.id
            }
          });

      if (projectExisting) {
        await prisma.project.update({
          where: { id: projectExisting.id },
          data: {
            llcId: llc.id,
            qbConnectionId: qbConnection.id,
            name: projectName,
            addressLine1,
            addressLine2: addressLine2 || null,
            city,
            state,
            zip,
            unitCount,
            cityNumber: cityNumber || null,
            status: status ?? projectExisting.status
          }
        });
        updatedProjects++;
      } else {
        await prisma.project.create({
          data: {
            orgId: user.orgId,
            llcId: llc.id,
            qbConnectionId: qbConnection.id,
            name: projectName,
            addressLine1,
            addressLine2: addressLine2 || null,
            city,
            state,
            zip,
            unitCount,
            cityNumber: cityNumber || null,
            status: status ?? "PLANNING"
          }
        });
        createdProjects++;
      }
    } catch (e) {
      errors.push({ row: rowNumber, message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "MASTER_SPREADSHEET_IMPORTED",
    entityType: "MasterSpreadsheet",
    entityId: null,
    data: { createdProjects, updatedProjects, createdLlcs, updatedLlcs, errorCount: errors.length }
  });

  return { ok: true, createdProjects, updatedProjects, createdLlcs, updatedLlcs, errors };
}
