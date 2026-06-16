"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { auditEvent } from "@/lib/audit";

const vendorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  expertise: z.string().optional().or(z.literal(""))
});

export async function createVendor(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = vendorSchema.parse({
    name: formData.get("name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    expertise: formData.get("expertise") ?? ""
  });

  const vendor = await prisma.vendor.create({
    data: {
      orgId: user.orgId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      expertise: data.expertise || null
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "VENDOR_CREATED",
    entityType: "Vendor",
    entityId: vendor.id,
    data: { name: vendor.name }
  });

  redirect("/app/vendors");
}
