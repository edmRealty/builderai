import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { decryptString } from "@/lib/crypto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { onboardingSaveBasic, onboardingSaveInsurance, onboardingSaveTax } from "@/lib/actions/vendor-onboarding";

function safeDecrypt(value: string | null) {
  if (!value) return "";
  try {
    return decryptString(value);
  } catch {
    return "";
  }
}

function fmtDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default async function VendorDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ vendorId: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const user = await requireUser();
  const { vendorId } = await params;
  const sp = await searchParams;
  const focus = (sp.onboarding ?? "").toString();

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      commitments: {
        include: { project: true },
        orderBy: { updatedAt: "desc" },
        take: 200
      },
      communications: {
        include: { project: true, createdBy: true },
        orderBy: { createdAt: "desc" },
        take: 50
      }
    }
  });

  if (!vendor || vendor.orgId !== user.orgId) redirect("/app/vendors");

  const canEdit = ["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role);
  const step = vendor.onboardingStep;
  const mailto = vendor.email
    ? `mailto:${encodeURIComponent(vendor.email)}?subject=${encodeURIComponent("Vendor onboarding reminder")}&body=${encodeURIComponent(`Hi ${vendor.contactName ?? vendor.name},\\n\\nPlease complete your onboarding items for ${vendor.name}.\\n\\nThanks`)}` 
    : null;

  const byProject = new Map<string, { projectName: string; agreed: number; paid: number; rows: any[] }>();
  for (const c of vendor.commitments) {
    const cur = byProject.get(c.projectId) ?? { projectName: c.project.name, agreed: 0, paid: 0, rows: [] };
    cur.agreed += c.agreedCents;
    cur.paid += c.paidToDateCents;
    cur.rows.push(c);
    byProject.set(c.projectId, cur);
  }

  const communicationLabels = { CALL: "Call", TEXT: "Text", EMAIL: "Email" } as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{vendor.name}</h1>
          <div className="text-sm text-fg/70">
            {vendor.email ?? ""}{vendor.phone ? ` • ${vendor.phone}` : ""}
          </div>
        </div>
        <Link className="underline" href="/app/vendors">Back to vendors</Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className={`rounded-md border px-3 py-2 ${step === "DONE" ? "border-border bg-muted/30 text-fg/70" : "border-danger bg-danger/10 text-danger"}`}>
            Status: {step === "DONE" ? "Complete" : "Incomplete"} • Current step: {step.replaceAll("_", " ")}
          </div>

          {mailto ? (
            <div className="text-xs text-fg/60">
              One-click reminder: <Link className="underline" href={mailto}>Email vendor</Link>
            </div>
          ) : (
            <div className="text-xs text-fg/60">Add a vendor email to enable one-click reminders.</div>
          )}

          {!canEdit ? (
            <div className="text-sm text-fg/70">Your role can’t edit vendor onboarding.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <Card className={focus === "basic" ? "ring-2 ring-primary" : ""}>
                <CardHeader>
                  <CardTitle className="text-base">1) Basic</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <form action={onboardingSaveBasic} className="space-y-2">
                    <input type="hidden" name="vendorId" value={vendor.id} />
                    <Input name="name" defaultValue={vendor.name} placeholder="Vendor name" required />
                    <Input name="contactName" defaultValue={vendor.contactName ?? ""} placeholder="Contact person" />
                    <Input name="email" type="email" defaultValue={vendor.email ?? ""} placeholder="Email" />
                    <Input name="phone" defaultValue={vendor.phone ?? ""} placeholder="Phone" />
                    <Input name="expertise" defaultValue={vendor.expertise ?? ""} placeholder="Expertise: plumbing, electric, drywall..." />
                    <Button size="sm" type="submit" className="w-full">Save progress</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className={focus === "tax" ? "ring-2 ring-primary" : ""}>
                <CardHeader>
                  <CardTitle className="text-base">2) Tax</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <form action={onboardingSaveTax} className="space-y-2">
                    <input type="hidden" name="vendorId" value={vendor.id} />
                    <Input name="ein" defaultValue={safeDecrypt(vendor.einEnc) || ""} placeholder="EIN" required />
                    <Input name="w9Url" defaultValue={vendor.w9Url ?? ""} placeholder="W-9 link (https://…)" />
                    <Input name="w9ExpiresAt" type="date" defaultValue={vendor.w9ExpiresAt ? vendor.w9ExpiresAt.toISOString().slice(0, 10) : ""} />
                    <Button size="sm" type="submit" className="w-full">Save progress</Button>
                  </form>
                  <div className="text-xs text-fg/60">W-9 is marked “on file” when a link is provided.</div>
                </CardContent>
              </Card>

              <Card className={focus === "insurance" ? "ring-2 ring-primary" : ""}>
                <CardHeader>
                  <CardTitle className="text-base">3) Insurance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <form action={onboardingSaveInsurance} className="space-y-2">
                    <input type="hidden" name="vendorId" value={vendor.id} />
                    <Input name="insuranceUrl" defaultValue={vendor.insuranceUrl ?? ""} placeholder="Insurance/COI link (https://…)" />
                    <Input name="coiExpiresAt" type="date" defaultValue={vendor.coiExpiresAt ? vendor.coiExpiresAt.toISOString().slice(0, 10) : ""} />
                    <Button size="sm" type="submit" className="w-full">Save progress</Button>
                  </form>
                  <div className="text-xs text-fg/60">COI is marked “on file” when a link is provided.</div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-fg/70">Approved</span><span className="font-medium">{vendor.approvedVendor ? "Yes" : "No"}</span></div>
            <div className="flex justify-between"><span className="text-fg/70">W-9 on file</span><span className="font-medium">{vendor.w9OnFile ? "Yes" : "No"}</span></div>
            <div className="flex justify-between"><span className="text-fg/70">COI on file</span><span className="font-medium">{vendor.coiOnFile ? "Yes" : "No"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-fg/70">Score</span><span className="font-medium">{vendor.performanceScore ?? "—"}</span></div>
            <div className="text-xs text-fg/60">Vendor scoring is expanded in Phase 3.</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CRM communications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {vendor.communications.length === 0 ? (
            <div className="text-sm text-fg/70">No communications logged yet.</div>
          ) : (
            <div className="space-y-2">
              {vendor.communications.map((comm) => (
                <div key={comm.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{communicationLabels[comm.type]}</div>
                    <div className="text-xs text-fg/60">{fmtDateTime(comm.createdAt)}</div>
                  </div>
                  <div className="mt-1 text-xs text-fg/70">
                    {comm.project ? (
                      <Link className="underline" href={`/app/projects/${comm.projectId}?tab=history`}>{comm.project.name}</Link>
                    ) : (
                      "Vendor-only"
                    )}
                    {" "}by {comm.createdBy.name ?? comm.createdBy.email}
                  </div>
                  {comm.note ? <div className="mt-1 text-xs text-fg/70">{comm.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commitments by project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {byProject.size === 0 ? (
            <div className="text-sm text-fg/70">No commitments yet.</div>
          ) : (
            [...byProject.entries()].map(([projectId, p]) => {
              const pct = p.agreed > 0 ? p.paid / p.agreed : 0;
              return (
                <div key={projectId} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="font-medium">
                      <Link className="underline" href={`/app/projects/${projectId}`}>{p.projectName}</Link>
                    </div>
                    <div className="text-sm text-fg/70">
                      Paid {formatMoney(p.paid)} / {formatMoney(p.agreed)} ({(pct * 100).toFixed(1)}%)
                    </div>
                  </div>

                  <div className="mt-3 overflow-auto rounded-md border border-border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted text-left">
                        <tr>
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2">Scope</th>
                          <th className="px-3 py-2">Agreed</th>
                          <th className="px-3 py-2">Paid</th>
                          <th className="px-3 py-2">Paid %</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {p.rows.map((c: any) => {
                          const paidPct = c.agreedCents > 0 ? c.paidToDateCents / c.agreedCents : 0;
                          return (
                            <tr key={c.id} className="odd:bg-muted/60 even:bg-card">
                              <td className="px-3 py-2 font-medium">{c.code}</td>
                              <td className="px-3 py-2">{c.scope}</td>
                              <td className="px-3 py-2">{formatMoney(c.agreedCents)}</td>
                              <td className="px-3 py-2">{formatMoney(c.paidToDateCents)}</td>
                              <td className="px-3 py-2">{(paidPct * 100).toFixed(1)}%</td>
                              <td className="px-3 py-2">{c.status.replaceAll("_", " ")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
