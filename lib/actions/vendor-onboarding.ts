"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { auditEvent } from "@/lib/audit";
import { encryptString } from "@/lib/crypto";

const basicSchema = z.object({
  name: z.string().min(2),
  contactName: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  expertise: z.string().optional().or(z.literal(""))
});

export async function onboardingCreateVendor(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = basicSchema.parse({
    name: formData.get("name"),
    contactName: formData.get("contactName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    expertise: formData.get("expertise") ?? ""
  });

  const vendor = await prisma.vendor.create({
    data: {
      orgId: user.orgId,
      name: data.name,
      contactName: data.contactName || null,
      email: data.email || null,
      phone: data.phone || null,
      expertise: data.expertise || null,
      onboardingStep: "TAX"
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "VENDOR_ONBOARDING_STARTED",
    entityType: "Vendor",
    entityId: vendor.id,
    data: { name: vendor.name }
  });

  redirect(`/app/vendors/${vendor.id}?onboarding=tax`);
}

function requireVendorOrg(vendor: { orgId: string } | null, orgId: string): asserts vendor is { orgId: string; onboardingStep: string; w9OnFile: boolean; w9Url: string | null; einEnc: string | null } {
  if (!vendor || vendor.orgId !== orgId) redirect("/app/vendors");
}

export async function onboardingSaveBasic(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = basicSchema.extend({ vendorId: z.string().min(1) }).parse({
    vendorId: formData.get("vendorId"),
    name: formData.get("name"),
    contactName: formData.get("contactName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    expertise: formData.get("expertise") ?? ""
  });

  const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
  requireVendorOrg(vendor, user.orgId);

  await prisma.vendor.update({
    where: { id: data.vendorId },
    data: {
      name: data.name,
      contactName: data.contactName || null,
      email: data.email || null,
      phone: data.phone || null,
      expertise: data.expertise || null,
      onboardingStep: vendor.onboardingStep === "BASIC" ? "TAX" : vendor.onboardingStep
    }
  });

  redirect(`/app/vendors/${data.vendorId}?onboarding=tax`);
}

const taxSchema = z.object({
  vendorId: z.string().min(1),
  ein: z.string().min(4),
  w9Url: z.string().url().optional().or(z.literal("")),
  w9ExpiresAt: z.string().optional().or(z.literal(""))
});

export async function onboardingSaveTax(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = taxSchema.parse({
    vendorId: formData.get("vendorId"),
    ein: formData.get("ein"),
    w9Url: formData.get("w9Url") ?? "",
    w9ExpiresAt: formData.get("w9ExpiresAt") ?? ""
  });

  const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
  requireVendorOrg(vendor, user.orgId);

  const w9ExpiresAt = data.w9ExpiresAt ? new Date(`${data.w9ExpiresAt}T00:00:00`) : null;

  await prisma.vendor.update({
    where: { id: data.vendorId },
    data: {
      einEnc: encryptString(data.ein.trim()),
      w9Url: data.w9Url || null,
      w9OnFile: Boolean(data.w9Url),
      w9ExpiresAt,
      onboardingStep: "INSURANCE"
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: "VENDOR_ONBOARDING_TAX_SAVED",
    entityType: "Vendor",
    entityId: data.vendorId
  });

  redirect(`/app/vendors/${data.vendorId}?onboarding=insurance`);
}

const insuranceSchema = z.object({
  vendorId: z.string().min(1),
  insuranceUrl: z.string().url().optional().or(z.literal("")),
  coiExpiresAt: z.string().optional().or(z.literal(""))
});

export async function onboardingSaveInsurance(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role)) redirect("/app/dashboard");

  const data = insuranceSchema.parse({
    vendorId: formData.get("vendorId"),
    insuranceUrl: formData.get("insuranceUrl") ?? "",
    coiExpiresAt: formData.get("coiExpiresAt") ?? ""
  });

  const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
  requireVendorOrg(vendor, user.orgId);

  const coiExpiresAt = data.coiExpiresAt ? new Date(`${data.coiExpiresAt}T00:00:00`) : null;
  const insuranceOk = Boolean(data.insuranceUrl);
  const w9Ok = Boolean(vendor.w9OnFile || vendor.w9Url);
  const done = insuranceOk && w9Ok && Boolean(vendor.einEnc);

  await prisma.vendor.update({
    where: { id: data.vendorId },
    data: {
      insuranceUrl: data.insuranceUrl || null,
      coiOnFile: insuranceOk,
      coiExpiresAt,
      onboardingStep: done ? "DONE" : "INSURANCE",
      onboardingCompletedAt: done ? new Date() : null
    }
  });

  await auditEvent({
    orgId: user.orgId,
    userId: user.id,
    action: done ? "VENDOR_ONBOARDING_COMPLETED" : "VENDOR_ONBOARDING_INSURANCE_SAVED",
    entityType: "Vendor",
    entityId: data.vendorId
  });

  redirect(`/app/vendors/${data.vendorId}?onboarding=${done ? "done" : "insurance"}`);
}
