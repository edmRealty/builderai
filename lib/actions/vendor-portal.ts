"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { parseMoneyToCents } from "@/lib/money";
import { sha256Hex } from "@/lib/crypto";

const submitSchema = z.object({
  token: z.string().min(10),
  amount: z.string().min(1),
  notes: z.string().optional().or(z.literal(""))
});

export async function submitVendorInvoice(formData: FormData) {
  const data = submitSchema.parse({
    token: formData.get("token"),
    amount: formData.get("amount"),
    notes: formData.get("notes") ?? ""
  });

  const tokenHash = sha256Hex(data.token);

  const req = await prisma.vendorInvoiceRequest.findUnique({
    where: { tokenHash },
    include: { commitment: { include: { vendor: true, project: true } } }
  });

  if (!req) redirect("/vendor/invalid");
  if (req.status !== "OPEN") redirect("/vendor/complete");
  if (req.expiresAt.getTime() < Date.now()) {
    await prisma.vendorInvoiceRequest.update({ where: { id: req.id }, data: { status: "EXPIRED" } });
    redirect("/vendor/expired");
  }

  const amountCents = parseMoneyToCents(data.amount);

  const upload = await prisma.vendorInvoiceUpload.create({
    data: {
      orgId: req.orgId,
      requestId: req.id,
      amountCents,
      notes: data.notes || null
    }
  });

  await prisma.vendorInvoiceRequest.update({
    where: { id: req.id },
    data: { status: "SUBMITTED" }
  });

  // Notify accountants.
  const accountants = await prisma.user.findMany({
    where: { orgId: req.orgId, role: "ACCOUNTANT" },
    select: { id: true }
  });

  if (accountants.length > 0) {
    await prisma.notification.createMany({
      data: accountants.map((a) => ({
        orgId: req.orgId,
        userId: a.id,
        type: "VENDOR_INVOICE_UPLOADED",
        title: "Vendor invoice uploaded",
        body: `${req.commitment.vendor.name} • ${req.commitment.code} • ${req.commitment.project.name}`,
        entityType: "VendorInvoiceUpload",
        entityId: upload.id
      }))
    });
  }

  // Integration hook (MVP): enqueue a task for QBO processing or a QBD agent instruction.
  const qbConn = await prisma.quickBooksConnection.findUnique({
    where: { id: req.commitment.project.qbConnectionId }
  });

  if (qbConn?.type === "QBD") {
    await prisma.qbdInstruction.create({
      data: {
        orgId: req.orgId,
        qbConnectionId: qbConn.id,
        type: "CREATE_BILL",
        payload: {
          uploadId: upload.id,
          commitmentId: req.commitmentId,
          commitmentCode: req.commitment.code,
          projectId: req.commitment.projectId,
          qbProjectRef: req.commitment.project.qbProjectRef,
          vendorId: req.commitment.vendorId,
          qbVendorRef: req.commitment.vendor.qbVendorRef,
          amountCents
        }
      }
    });
  } else if (qbConn?.type === "QBO") {
    await prisma.integrationEvent.create({
      data: {
        orgId: req.orgId,
        qbConnectionId: qbConn.id,
        source: "QBO_TASK_CREATE_BILL",
        payload: {
          uploadId: upload.id,
          commitmentId: req.commitmentId,
          commitmentCode: req.commitment.code,
          projectId: req.commitment.projectId,
          qbProjectRef: req.commitment.project.qbProjectRef,
          vendorId: req.commitment.vendorId,
          qbVendorRef: req.commitment.vendor.qbVendorRef,
          amountCents
        }
      }
    });
  }

  redirect("/vendor/thanks");
}
