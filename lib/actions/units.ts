"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { assertCanMutateProject, requireProject } from "@/lib/access";
import { auditEvent } from "@/lib/audit";

const unitSchema = z.object({
  projectId: z.string().min(1),
  unitNumber: z.string().min(1),
  bedrooms: z.string().optional().or(z.literal("")),
  baths: z.string().optional().or(z.literal("")),
  sqft: z.string().optional().or(z.literal(""))
});

function parseOptionalInt(value: string) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseOptionalFloat(value: string) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function createUnit(formData: FormData) {
  const user = await requireUser();
  assertCanMutateProject(user);

  const data = unitSchema.parse({
    projectId: formData.get("projectId"),
    unitNumber: formData.get("unitNumber"),
    bedrooms: formData.get("bedrooms") ?? "",
    baths: formData.get("baths") ?? "",
    sqft: formData.get("sqft") ?? ""
  });

  await requireProject(user, data.projectId);

  const bedrooms = parseOptionalInt(data.bedrooms || "");
  const baths = parseOptionalFloat(data.baths || "");
  const sqft = parseOptionalInt(data.sqft || "");

  const unitNumber = data.unitNumber.trim();

  try {
    const unit = await prisma.unit.create({
      data: {
        orgId: user.orgId,
        projectId: data.projectId,
        unitNumber,
        bedrooms,
        baths,
        sqft
      }
    });

    await auditEvent({
      orgId: user.orgId,
      userId: user.id,
      action: "UNIT_CREATED",
      entityType: "Unit",
      entityId: unit.id,
      data: { unitNumber }
    });
  } catch {
    // If unit already exists, treat as an update.
    await prisma.unit.updateMany({
      where: { orgId: user.orgId, projectId: data.projectId, unitNumber },
      data: { bedrooms, baths, sqft }
    });
  }

  redirect(`/app/projects/${data.projectId}?tab=overview`);
}
