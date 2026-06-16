import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FilePlus2,
  ShieldAlert,
  Wrench,
  type LucideIcon
} from "lucide-react";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { VendorCrmActions } from "./vendor-crm-actions";

type VendorRemark = {
  key: string;
  label: string;
  className: string;
  icon: LucideIcon;
};

function expertiseList(value: string | null, vendorName = "") {
  const explicit = (value ?? "")
    .split(/[,/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (explicit.length) return explicit.slice(0, 5);

  const name = vendorName.toLowerCase();
  const inferred: string[] = [];
  if (name.includes("plumb")) inferred.push("Plumbing");
  if (name.includes("electric")) inferred.push("Electric");
  if (name.includes("fram")) inferred.push("Framing");
  if (name.includes("drywall")) inferred.push("Drywall");
  if (name.includes("hvac")) inferred.push("HVAC");
  if (name.includes("kitchen")) inferred.push("Kitchens");
  if (name.includes("roof")) inferred.push("Roofing");
  if (name.includes("concrete")) inferred.push("Concrete");
  if (name.includes("paint") || name.includes("finish")) inferred.push("Paint/Finish");
  if (name.includes("sitework") || name.includes("grading")) inferred.push("Sitework");
  return inferred.slice(0, 5);
}

function buildVendorRemarks(v: {
  approvedVendor: boolean;
  coiOnFile: boolean;
  insuranceUrl: string | null;
  coiExpiresAt: Date | null;
  commitments: Array<{
    targetCompleteDate: Date | null;
    completedAt: Date | null;
    invoicedNotPaidCents: number;
    invoiceRequests: Array<{
      status: string;
      uploads: Array<{ createdAt: Date }>;
    }>;
  }>;
}) {
  const remarks: VendorRemark[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 14);
  const recent = new Date(now);
  recent.setDate(recent.getDate() - 7);

  if (!v.coiOnFile && !v.insuranceUrl) {
    remarks.push({
      key: "missing-insurance",
      label: "Vendor missing insurance certificate",
      className: "border-red-200 bg-red-50 text-red-700",
      icon: ShieldAlert
    });
  } else if (v.coiExpiresAt && v.coiExpiresAt < today) {
    remarks.push({
      key: "expired-insurance",
      label: "Vendor insurance expired",
      className: "border-red-200 bg-red-50 text-red-700",
      icon: AlertTriangle
    });
  } else if (v.coiExpiresAt && v.coiExpiresAt <= soon) {
    remarks.push({
      key: "insurance-expiring",
      label: "Insurance expires soon",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      icon: AlertTriangle
    });
  }

  if (!v.approvedVendor) {
    remarks.push({
      key: "do-not-pay",
      label: "Do Not Pay message added",
      className: "border-red-200 bg-red-50 text-red-700",
      icon: Ban
    });
  }

  const deadlinesSoon = v.commitments.filter((c) => c.targetCompleteDate && !c.completedAt && c.targetCompleteDate >= today && c.targetCompleteDate <= soon);
  if (deadlinesSoon.length) {
    remarks.push({
      key: "deadline-soon",
      label: deadlinesSoon.length === 1 ? "Completion deadline coming soon" : `${deadlinesSoon.length} completion deadlines coming soon`,
      className: "border-amber-200 bg-amber-50 text-amber-700",
      icon: CalendarClock
    });
  }

  const hasRecentInvoice = v.commitments.some((c) =>
    c.invoiceRequests.some((r) =>
      r.status === "SUBMITTED" || r.uploads.some((u) => u.createdAt >= recent)
    )
  );
  if (hasRecentInvoice) {
    remarks.push({
      key: "new-invoice",
      label: "New invoice received",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      icon: FilePlus2
    });
  }

  const invoicedNotPaid = v.commitments.reduce((sum, c) => sum + Math.max(c.invoicedNotPaidCents, 0), 0);
  if (invoicedNotPaid > 0) {
    remarks.push({
      key: "invoice-awaiting-payment",
      label: `${formatMoney(invoicedNotPaid)} invoiced not paid`,
      className: "border-violet-200 bg-violet-50 text-violet-700",
      icon: CircleDollarSign
    });
  }

  if (!remarks.length) {
    remarks.push({
      key: "clear",
      label: "No automatic remarks",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2
    });
  }

  return remarks;
}

export default async function VendorsPage() {
  const user = await requireUser();

  const vendors = await prisma.vendor.findMany({
    where: { orgId: user.orgId },
    orderBy: { updatedAt: "desc" },
    include: {
      commitments: {
        orderBy: { updatedAt: "desc" },
        select: {
          projectId: true,
          agreedCents: true,
          paidToDateCents: true,
          invoicedNotPaidCents: true,
          targetCompleteDate: true,
          completedAt: true,
          invoiceRequests: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              status: true,
              uploads: {
                orderBy: { createdAt: "desc" },
                take: 3,
                select: { createdAt: true }
              }
            }
          }
        }
      }
    }
  });

  const canCreate = ["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Vendors</h1>
          <p className="text-sm text-fg/70">Directory used for commitments and invoice requests.</p>
        </div>
        {canCreate ? (
          <Link href="/app/vendors/new">
            <Button type="button">Add New Vendor</Button>
          </Link>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendor list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vendors.length === 0 ? (
            <p className="text-sm text-fg/70">No vendors yet.</p>
          ) : (
            <div className="overflow-auto rounded-md border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">CRM</th>
                    <th className="px-3 py-2">Expertise</th>
                    <th className="px-3 py-2 text-right">Balance due Next</th>
                    <th className="px-3 py-2 text-right">Balance due Total</th>
                    <th className="px-3 py-2">Auto remarks</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vendors.map((v) => {
                    const skills = expertiseList(v.expertise, v.name);
                    const projectIds = [...new Set(v.commitments.map((c) => c.projectId))];
                    const balanceDueNext = v.commitments.reduce(
                      (sum, c) => sum + Math.max(c.invoicedNotPaidCents, 0),
                      0
                    );
                    const balanceDueTotal = v.commitments.reduce(
                      (sum, c) => sum + Math.max(c.agreedCents - c.paidToDateCents, 0),
                      0
                    );
                    const remarks = buildVendorRemarks(v);

                    return (
                      <tr key={v.id} className="align-top odd:bg-muted/60 even:bg-card">
                        <td className="min-w-56 px-3 py-3">
                          <div className="font-medium">
                            <Link className="underline" href={`/app/vendors/${v.id}`}>{v.name}</Link>
                          </div>
                          <div className="text-sm text-fg/70">{v.email ?? ""}{v.phone ? ` - ${v.phone}` : ""}</div>
                          <div className="mt-1 text-xs text-fg/60">
                            Onboarding: {v.onboardingStep === "DONE" ? "Complete" : "Incomplete"}
                          </div>
                        </td>
                        <td className="min-w-36 px-3 py-3">
                          <VendorCrmActions vendorId={v.id} phone={v.phone} email={v.email} projectIds={projectIds} />
                          <div className="mt-1 text-xs text-fg/50">
                            {projectIds.length === 0 ? "Vendor-only log" : projectIds.length === 1 ? "Logs to 1 project" : `Logs to ${projectIds.length} projects`}
                          </div>
                        </td>
                        <td className="min-w-48 px-3 py-3">
                          {skills.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {skills.map((skill) => (
                                <span key={skill} className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2 py-1 text-xs text-fg/80">
                                  <Wrench className="h-3 w-3 text-fg/50" />
                                  {skill}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-fg/50">Add on vendor profile</span>
                          )}
                        </td>
                        <td className="min-w-32 px-3 py-3 text-right font-medium">
                          {formatMoney(balanceDueNext)}
                        </td>
                        <td className="min-w-32 px-3 py-3 text-right font-medium">
                          {formatMoney(balanceDueTotal)}
                        </td>
                        <td className="min-w-80 px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {remarks.map((remark) => {
                              const Icon = remark.icon;
                              return (
                                <span key={remark.key} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${remark.className}`}>
                                  <Icon className="h-3.5 w-3.5" />
                                  {remark.label}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="min-w-28 px-3 py-3 text-fg/70">
                          {v.approvedVendor ? "Approved" : "Not approved"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
