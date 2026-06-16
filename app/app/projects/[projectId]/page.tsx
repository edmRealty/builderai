import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { requireProject } from "@/lib/access";
import { formatMoney } from "@/lib/format";
import { decryptString } from "@/lib/crypto";
import { createCommitment, createVendorInvoiceRequest, markCommitmentCompleted } from "@/lib/actions/commitments";
import { addProjectUpdate } from "@/lib/actions/updates";
import { createPermit } from "@/lib/actions/permits";
import { createAbatement } from "@/lib/actions/abatements";
import { createDrawRequest, setDrawReadyForBank } from "@/lib/actions/draws";
import { createUnit } from "@/lib/actions/units";
import { addProjectPhoto } from "@/lib/actions/photos";
import { createPlanSet } from "@/lib/actions/plan-sets";
import { createInspection, markInspectionCompleted } from "@/lib/actions/inspections";
import { addProjectCustomSectionItem, createProjectCustomSection } from "@/lib/actions/custom-sections";
import { createReminder, toggleReminderCompleted } from "@/lib/actions/reminders";
import { addProjectIdentifier } from "@/lib/actions/project-identifiers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProjectStatusControl } from "../project-status-control";

function safeDecrypt(value: string | null) {
  if (!value) return null;
  try {
    return decryptString(value);
  } catch {
    return null;
  }
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "vendors", label: "Vendors & Milestones" },
  { key: "draws", label: "Draws" },
  { key: "docs", label: "Permits / Plans / Docs" },
  { key: "updates", label: "Updates" },
  { key: "history", label: "History" }
] as const;

type TabKey = (typeof TABS)[number]["key"];

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function progressColorClass(p: number) {
  if (p < 0.25) return "bg-red-500";
  if (p < 0.5) return "bg-orange-500";
  if (p < 0.75) return "bg-amber-500";
  return "bg-green-600";
}

function googleMapsEmbedSrc(address: string) {
  const q = encodeURIComponent(address);
  return `https://www.google.com/maps?q=${q}&output=embed`;
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

export default async function ProjectPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const sp = await searchParams;

  const project = await requireProject(user, projectId);

  const projectFull = await prisma.project.findUnique({
    where: { id: project.id },
    include: { llc: true, qbConnection: true }
  });
  if (!projectFull) redirect("/app/projects");

  const rawTab = sp.tab;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "overview";

  const [
    commitments,
    updates,
    permits,
    abatements,
    planSets,
    inspections,
    units,
    partners,
    photos,
    customSections,
    assignments,
    vendors,
    loans,
    templates,
    draws,
    reminders,
    vendorCommunications,
    bankCommunications,
    identifierDefs,
    projectIdentifiers
  ] = await Promise.all([
    prisma.commitment.findMany({
      where: { orgId: user.orgId, projectId: project.id },
      include: { vendor: true, createdBy: true, invoiceRequests: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.projectUpdate.findMany({
      where: { orgId: user.orgId, projectId: project.id },
      include: { author: true },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.permit.findMany({ where: { orgId: user.orgId, projectId: project.id }, orderBy: { createdAt: "desc" } }),
    prisma.abatement.findMany({ where: { orgId: user.orgId, projectId: project.id }, orderBy: { createdAt: "desc" } }),
    prisma.planSet.findMany({ where: { orgId: user.orgId, projectId: project.id }, orderBy: { createdAt: "desc" } }),
    prisma.inspection.findMany({ where: { orgId: user.orgId, projectId: project.id }, orderBy: { createdAt: "desc" } }),
    prisma.unit.findMany({ where: { orgId: user.orgId, projectId: project.id }, orderBy: { unitNumber: "asc" } }),
    prisma.projectPartner.findMany({
      where: { orgId: user.orgId, projectId: project.id },
      include: { partner: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.projectPhoto.findMany({ where: { orgId: user.orgId, projectId: project.id }, orderBy: { createdAt: "desc" } }),
    prisma.projectCustomSection.findMany({
      where: { orgId: user.orgId, OR: [{ projectId: null }, { projectId: project.id }] },
      include: { items: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.projectAssignment.findMany({
      where: { orgId: user.orgId, projectId: project.id },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.vendor.findMany({ where: { orgId: user.orgId }, orderBy: { name: "asc" } }),
    prisma.loan.findMany({ where: { orgId: user.orgId, projectId: project.id }, include: { bank: true }, orderBy: { createdAt: "desc" } }),
    prisma.drawTemplate.findMany({ where: { orgId: user.orgId }, include: { bank: true }, orderBy: { createdAt: "desc" } }),
    prisma.drawRequest.findMany({
      where: { orgId: user.orgId, projectId: project.id },
      include: { loan: { include: { bank: true } }, template: true },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.reminder.findMany({
      where: { orgId: user.orgId, projectId: project.id },
      include: { createdBy: true },
      orderBy: [{ completedAt: "asc" }, { createdAt: "desc" }],
      take: 50
    }),
    prisma.vendorCommunication.findMany({
      where: { orgId: user.orgId, projectId: project.id },
      include: { vendor: true, createdBy: true },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.bankCommunication.findMany({
      where: { orgId: user.orgId, projectId: project.id },
      include: { bank: true, createdBy: true },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.identifierDefinition.findMany({
      where: { orgId: user.orgId, scope: "PROJECT" },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    }),
    prisma.projectIdentifier.findMany({
      where: { orgId: user.orgId, projectId: project.id },
      include: { definition: true },
      orderBy: [{ updatedAt: "desc" }]
    })
  ]);

  const canMutate = user.role !== "BANKER";
  const canCreateDraw = ["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role);
  const canManageProject = ["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role);

  const pmAssignments = assignments.filter((a) => a.user.role === "PROJECT_MANAGER").map((a) => a.user);
  const fieldAssignments = assignments.filter((a) => a.user.role === "FIELD_AGENT").map((a) => a.user);

  const totals = commitments.reduce(
    (acc, c) => {
      acc.agreed += c.agreedCents;
      acc.paid += c.paidToDateCents;
      return acc;
    },
    { agreed: 0, paid: 0 }
  );
  const progress = totals.agreed > 0 ? clamp01(totals.paid / totals.agreed) : 0;

  const openReminders = reminders.filter((r) => !r.completedAt);
  const fullAddress = `${projectFull.addressLine1}, ${projectFull.city}, ${projectFull.state} ${projectFull.zip}`;

  const vendorSummary = new Map<string, { vendorName: string; agreed: number; paid: number }>();
  for (const c of commitments) {
    const cur = vendorSummary.get(c.vendorId) ?? { vendorName: c.vendor.name, agreed: 0, paid: 0 };
    cur.agreed += c.agreedCents;
    cur.paid += c.paidToDateCents;
    vendorSummary.set(c.vendorId, cur);
  }

  const identifierValueByLabel = new Map<string, string>();
  for (const pi of projectIdentifiers) {
    identifierValueByLabel.set(pi.definition.label, pi.value);
  }

  type HistoryItem = { at: Date; title: string; by?: string; detail?: string };
  const history: HistoryItem[] = [];
  history.push({ at: projectFull.createdAt, title: "Project started", by: "System", detail: projectFull.name });
  for (const r of reminders) {
    const who = r.createdBy.name ?? r.createdBy.email;
    history.push({ at: r.createdAt, title: "Reminder added", by: who, detail: r.body });
    if (r.completedAt) history.push({ at: r.completedAt, title: "Reminder completed", by: who, detail: r.body });
  }
  for (const c of commitments) {
    const who = c.createdBy.name ?? c.createdBy.email;
    history.push({ at: c.createdAt, title: "Commitment created", by: who, detail: `${c.vendor.name}: ${c.scope} (${c.code})` });
    if (c.completedAt) history.push({ at: c.completedAt, title: "Milestone marked completed", by: "System", detail: `${c.vendor.name}: ${c.scope} (${c.code})` });
  }
  for (const p of permits) history.push({ at: p.issuedAt ?? p.createdAt, title: "Permit received", by: "System", detail: `${p.permitType} • ${p.jurisdiction}` });
  for (const a of abatements) history.push({ at: a.createdAt, title: "Tax abatement filed", by: "System", detail: a.programName });
  for (const ps of planSets) history.push({ at: ps.receivedAt ?? ps.createdAt, title: "Plan set added", by: "System", detail: `${ps.name} v${ps.version}` });
  for (const i of inspections) {
    history.push({ at: i.createdAt, title: "Inspection scheduled", by: "System", detail: i.name });
    if (i.completedAt) history.push({ at: i.completedAt, title: "Inspection completed", by: "System", detail: i.name });
  }
  for (const u of updates) history.push({ at: u.createdAt, title: "Project update posted", by: u.author.name ?? u.author.email, detail: `${u.body.slice(0, 80)}${u.body.length > 80 ? "…" : ""}` });
  for (const ph of photos) history.push({ at: ph.createdAt, title: "Photo added", by: "System", detail: ph.title ?? "Project photo" });
  const communicationLabels = { CALL: "Call", TEXT: "Text", EMAIL: "Email" } as const;
  for (const comm of vendorCommunications) {
    const label = communicationLabels[comm.type];
    history.push({
      at: comm.createdAt,
      title: `Vendor ${label.toLowerCase()} logged`,
      by: comm.createdBy.name ?? comm.createdBy.email,
      detail: `${comm.vendor.name}${comm.note ? `: ${comm.note}` : ""}`
    });
  }
  for (const comm of bankCommunications) {
    const label = communicationLabels[comm.type];
    history.push({
      at: comm.createdAt,
      title: `Bank ${label.toLowerCase()} logged`,
      by: comm.createdBy.name ?? comm.createdBy.email,
      detail: `${comm.bank.name}${comm.note ? `: ${comm.note}` : ""}`
    });
  }
  for (const d of draws) {
    history.push({ at: d.createdAt, title: "Draw created", by: "System", detail: `${d.loan.bank.name} • ${d.loan.name} (${d.status.replaceAll("_", " ")})` });
    if (d.approvedAt) history.push({ at: d.approvedAt, title: "Draw approved", by: "Banker", detail: `${d.loan.bank.name} • ${d.loan.name}` });
    if (d.fundedAt) history.push({ at: d.fundedAt, title: "Draw funded", by: "System", detail: `${d.loan.bank.name} • ${d.loan.name}` });
  }
  for (const pi of projectIdentifiers) {
    history.push({ at: pi.updatedAt, title: "Identifier updated", by: "System", detail: `${pi.definition.label}: ${pi.value}` });
  }
  history.sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-bg p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-fg/60">Project</div>
            <h1 className="text-2xl font-semibold">{projectFull.name}</h1>
            <div className="mt-1 text-sm text-fg/70">{fullAddress}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-fg/60">
              <ProjectStatusControl projectId={projectFull.id} status={projectFull.status} editable={canManageProject} />
              <span className="rounded-md bg-muted px-2 py-1">Units: {projectFull.unitCount ?? "—"}</span>
              <span className="rounded-md bg-muted px-2 py-1">Zip: {projectFull.zip}</span>
              <span className="rounded-md bg-muted px-2 py-1">Open reminders: {openReminders.length}</span>
            </div>
          </div>

          <div className="min-w-[280px] flex-1 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="text-xs text-fg/60">Estimated project cost</div>
                <div className="font-medium">{projectFull.budgetTotalCents ? formatMoney(projectFull.budgetTotalCents) : "—"}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-fg/60">% Complete (paid/committed)</div>
                <div className="font-medium">{(progress * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
              <div className={`h-full ${progressColorClass(progress)}`} style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-fg/60">
              <div>Paid {formatMoney(totals.paid)}</div>
              <div>Committed {formatMoney(totals.agreed)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/app/projects">
              <Button variant="secondary" type="button">Back</Button>
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/app/projects/${projectFull.id}?tab=${t.key}`}
                className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-primary text-primaryFg" : "bg-muted text-fg hover:bg-border"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-fg/70">Corp</span>
                <Link className="underline" href={`/app/llcs/${projectFull.llcId}`}>{projectFull.llc.name}</Link>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-fg/70">EIN</span>
                <Link className="underline" href={`/app/llcs/${projectFull.llcId}`}>{safeDecrypt(projectFull.llc.einEnc) ?? "—"}</Link>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-fg/70">City tax / city #</span>
                <span className="font-medium">{projectFull.cityNumber ?? "—"}</span>
              </div>

              {identifierDefs.length > 0 ? (
                <div className="pt-2">
                  <div className="text-xs font-medium text-fg/60">More identifiers</div>
                  <div className="mt-2 divide-y divide-border rounded-md border border-border">
                    {identifierDefs.slice(0, 6).map((def) => (
                      <div key={def.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs odd:bg-muted/60 even:bg-card">
                        <span className="text-fg/70">{def.label}</span>
                        <span className="font-medium">{identifierValueByLabel.get(def.label) ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {canMutate ? (
                <details className="pt-2">
                  <summary className="cursor-pointer select-none text-xs font-medium text-primary">Add more</summary>
                  <div className="mt-2 rounded-md border border-border p-3">
                    <form action={addProjectIdentifier} className="grid gap-2">
                      <input type="hidden" name="projectId" value={projectFull.id} />
                      <Input name="label" placeholder="Identifier label (e.g., PA Tax #)" required />
                      <Input name="value" placeholder="Value" required />
                      <label className="flex items-center gap-2 text-xs text-fg/70">
                        <input type="checkbox" name="applyToAllProjects" value="true" />
                        Apply this identifier field to all projects (value stays per-project)
                      </label>
                      <Button size="sm" type="submit">Save</Button>
                    </form>
                  </div>
                </details>
              ) : null}

              <div className="pt-2 text-xs text-fg/60">
                QuickBooks connection: {projectFull.qbConnection.displayName} ({projectFull.qbConnection.type})
              </div>
            </CardContent>
          </Card>

          <Card id="reminders">
            <CardHeader>
              <CardTitle className="text-base">Reminders / To‑do</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canMutate ? (
                <form action={createReminder} className="space-y-2">
                  <input type="hidden" name="projectId" value={projectFull.id} />
                  <Input name="body" placeholder="Add a reminder…" required />
                  <Input name="dueAt" type="date" />
                  <Button size="sm" type="submit" className="w-full">Add reminder</Button>
                </form>
              ) : null}

              {openReminders.length === 0 ? (
                <div className="text-sm text-fg/70">No open reminders.</div>
              ) : (
                <div className="space-y-2">
                  {openReminders.slice(0, 8).map((r) => (
                    <div key={r.id} className="rounded-md border border-border p-2 text-sm">
                      <div className="font-medium">{r.body}</div>
                      <div className="text-xs text-fg/60">
                        {r.dueAt ? `Due ${r.dueAt.toLocaleDateString()} • ` : ""}By{" "}{r.createdBy.email}
                      </div>
                      {canMutate ? (
                        <form action={toggleReminderCompleted} className="mt-2">
                          <input type="hidden" name="reminderId" value={r.id} />
                          <Button size="sm" variant="secondary" type="submit" className="w-full">Mark done</Button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-6">
          {tab === "overview" ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Identifiers & location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="text-xs text-fg/60">Project name</div>
                      <div className="font-medium">{projectFull.name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-fg/60">City tax / city #</div>
                      <div className="font-medium">{projectFull.cityNumber ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-fg/60">LLC</div>
                      <div className="font-medium">
                        <Link className="underline" href={`/app/llcs/${projectFull.llcId}`}>{projectFull.llc.name}</Link>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-fg/60">QB Project / Job ref</div>
                      <div className="font-medium">{projectFull.qbProjectRef ?? "—"}</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="overflow-hidden rounded-md border border-border">
                      <iframe title="Map" src={googleMapsEmbedSrc(fullAddress)} className="h-56 w-full" loading="lazy" />
                      <div className="px-3 py-2 text-xs text-fg/60">
                        <Link className="underline" href={`https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noreferrer">
                          Open in Maps
                        </Link>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-medium">Photos</div>
                      {photos.length === 0 ? (
                        <div className="text-sm text-fg/70">No photos yet.</div>
                      ) : (
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {photos.map((p) => (
                            <div key={p.id} className="min-w-[220px] overflow-hidden rounded-md border border-border">
                              <img src={p.url} alt={p.title ?? "Project photo"} className="h-32 w-full object-cover" />
                              <div className="px-3 py-2 text-sm">
                                <div className="font-medium">{p.title ?? "Photo"}</div>
                                <div className="text-xs text-fg/60">{p.createdAt.toLocaleDateString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {canMutate ? (
                        <div className="rounded-md border border-border p-3">
                          <div className="mb-2 text-sm font-medium">Add photo (URL for now)</div>
                          <form action={addProjectPhoto} className="grid gap-2 md:grid-cols-2">
                            <input type="hidden" name="projectId" value={projectFull.id} />
                            <Input name="title" placeholder="Title (optional)" />
                            <Input name="url" placeholder="Image URL (https://…)" required />
                            <div className="md:col-span-2">
                              <Button size="sm" type="submit">Add photo</Button>
                            </div>
                          </form>
                          <div className="mt-2 text-xs text-fg/60">File uploads to S3 are wired in Phase 2 (AWS).</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Property & units</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <div className="text-xs text-fg/60">Unit count</div>
                        <div className="font-medium">{projectFull.unitCount ?? "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-fg/60">Units tracked</div>
                        <div className="font-medium">{units.length}</div>
                      </div>
                    </div>

                    {units.length === 0 ? (
                      <div className="text-fg/70">No units added yet.</div>
                    ) : (
                      <div className="overflow-auto rounded-md border border-border">
                        <table className="min-w-full text-sm">
                          <thead className="bg-muted text-left">
                            <tr>
                              <th className="px-3 py-2">Unit</th>
                              <th className="px-3 py-2">Beds</th>
                              <th className="px-3 py-2">Baths</th>
                              <th className="px-3 py-2">Sqft</th>
                              <th className="px-3 py-2">Rental</th>
                              <th className="px-3 py-2">Rent</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {units.map((u) => (
                              <tr key={u.id} className="odd:bg-muted/60 even:bg-card">
                                <td className="px-3 py-2 font-medium">{u.unitNumber}</td>
                                <td className="px-3 py-2">{u.bedrooms ?? "—"}</td>
                                <td className="px-3 py-2">{u.baths ?? "—"}</td>
                                <td className="px-3 py-2">{u.sqft ?? "—"}</td>
                                <td className="px-3 py-2">{u.rentalStatus?.replaceAll("_", " ") ?? "—"}</td>
                                <td className="px-3 py-2">{u.rentCents ? formatMoney(u.rentCents) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {canMutate ? (
                      <div className="rounded-md border border-border p-3">
                        <div className="mb-2 text-sm font-medium">Add unit</div>
                        <form action={createUnit} className="grid gap-2 md:grid-cols-4">
                          <input type="hidden" name="projectId" value={projectFull.id} />
                          <Input name="unitNumber" placeholder="Unit (e.g., 1A)" required />
                          <Input name="bedrooms" type="number" placeholder="Beds" />
                          <Input name="baths" type="number" step="0.5" placeholder="Baths" />
                          <Input name="sqft" type="number" placeholder="Sqft" />
                          <div className="md:col-span-4">
                            <Button size="sm" type="submit">Save unit</Button>
                          </div>
                        </form>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Team & financials</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <div className="text-xs text-fg/60">Project managers</div>
                      {pmAssignments.length === 0 ? (
                        <div className="text-fg/70">None assigned.</div>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {pmAssignments.map((pm) => (
                            <div key={pm.id} className="rounded-md border border-border px-3 py-2">
                              <div className="font-medium">
                                <Link className="underline" href={`/app/users/${pm.id}`}>{pm.name ?? pm.email}</Link>
                              </div>
                              <div className="text-xs text-fg/70">{pm.email}{pm.phone ? ` • ${pm.phone}` : ""}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs text-fg/60">Field managers</div>
                      {fieldAssignments.length === 0 ? (
                        <div className="text-fg/70">None assigned.</div>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {fieldAssignments.map((fm) => (
                            <div key={fm.id} className="rounded-md border border-border px-3 py-2">
                              <div className="font-medium">
                                <Link className="underline" href={`/app/users/${fm.id}`}>{fm.name ?? fm.email}</Link>
                              </div>
                              <div className="text-xs text-fg/70">{fm.email}{fm.phone ? ` • ${fm.phone}` : ""}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border pt-3">
                      <div className="text-xs text-fg/60">Loans</div>
                      {loans.length === 0 ? (
                        <div className="text-fg/70">No loans linked yet.</div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {loans.map((l) => {
                            const total = l.totalLoanCents ?? 0;
                            const paid = l.paidToDateCents ?? 0;
                            const remaining = Math.max(0, total - paid);
                            return (
                              <div key={l.id} className="rounded-md border border-border p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="font-medium">
                                      <Link className="underline" href={`/app/banks/${l.bankId}`}>{l.bank.name}</Link>
                                    </div>
                                    <div className="text-xs text-fg/70">{l.name}{l.loanNumber ? ` • ${l.loanNumber}` : ""}</div>
                                    <div className="mt-2 text-xs text-fg/70">
                                      Contact: {l.bank.contactName ?? "—"}{l.bank.contactPhone ? ` • ${l.bank.contactPhone}` : ""}{l.bank.contactEmail ? ` • ${l.bank.contactEmail}` : ""}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div>Total loan: {total ? formatMoney(total) : "—"}</div>
                                    <div className="text-fg/70">Paid so far: {formatMoney(paid)}</div>
                                    <div className="text-fg/70">Remaining: {total ? formatMoney(remaining) : "—"}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {partners.length > 0 ? (
                      <div className="rounded-md border border-border p-3">
                        <div className="mb-2 text-sm font-medium">Partners</div>
                        <div className="space-y-2">
                          {partners.map((pp) => (
                            <div key={pp.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                              <div>
                                <div className="font-medium">{pp.partner.name}</div>
                                <div className="text-xs text-fg/70">{pp.partner.email ?? ""}{pp.partner.phone ? ` • ${pp.partner.phone}` : ""}</div>
                              </div>
                              <div className="text-right text-xs">
                                <div>{(pp.ownershipBps / 100).toFixed(2)}%</div>
                                <div className="text-fg/70">Initial: {formatMoney(pp.initialInvestmentCents)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {tab === "vendors" ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Vendor summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {vendorSummary.size === 0 ? (
                    <p className="text-sm text-fg/70">No vendors/commitments yet.</p>
                  ) : (
                    <div className="overflow-auto rounded-md border border-border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted text-left">
                          <tr>
                            <th className="px-3 py-2">Vendor</th>
                            <th className="px-3 py-2">Agreed</th>
                            <th className="px-3 py-2">Paid</th>
                            <th className="px-3 py-2">Paid %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {[...vendorSummary.entries()].map(([vendorId, row]) => {
                            const pct = row.agreed > 0 ? row.paid / row.agreed : 0;
                            return (
                              <tr key={vendorId} className="odd:bg-muted/60 even:bg-card">
                                <td className="px-3 py-2 font-medium">
                                  <Link className="underline" href={`/app/vendors/${vendorId}`}>{row.vendorName}</Link>
                                </td>
                                <td className="px-3 py-2">{formatMoney(row.agreed)}</td>
                                <td className="px-3 py-2">{formatMoney(row.paid)}</td>
                                <td className="px-3 py-2">{(pct * 100).toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Commitments & milestones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {canMutate ? (
                    <div className="rounded-md border border-border p-3">
                      <div className="mb-2 text-sm font-medium">Add commitment (agreed job price / PO)</div>
                      <form action={createCommitment} className="grid gap-2 md:grid-cols-2">
                        <input type="hidden" name="projectId" value={projectFull.id} />
                        <select name="vendorId" className="h-10 rounded-md border border-border bg-bg px-3 text-sm" required>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                        <Input name="costCode" placeholder="Cost code" required />
                        <Input name="scope" placeholder="Scope / job description" required />
                        <Input name="agreed" placeholder="Agreed amount (e.g., 12000)" required />
                        <Input name="retainagePct" type="number" placeholder="Retainage % (optional)" />
                        <div className="md:col-span-2">
                          <Button variant="secondary" type="submit">Create commitment</Button>
                        </div>
                      </form>
                    </div>
                  ) : null}

                  {commitments.length === 0 ? (
                    <div className="text-sm text-fg/70">No commitments yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {commitments.map((c) => {
                        const paidPct = c.agreedCents > 0 ? c.paidToDateCents / c.agreedCents : 0;
                        const latestReq = c.invoiceRequests[0];
                        const token = latestReq?.tokenEnc ? safeDecrypt(latestReq.tokenEnc) : null;
                        const vendorLink = token ? `/vendor/${encodeURIComponent(token)}` : null;
                        const canComplete = ["NOT_STARTED", "IN_PROGRESS"].includes(c.status);

                        return (
                          <div key={c.id} className="rounded-md border border-border p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">
                                  <Link className="underline" href={`/app/vendors/${c.vendorId}`}>{c.vendor.name}</Link>
                                </div>
                                <div className="text-xs text-fg/70">{c.scope}</div>
                                <div className="mt-1 text-xs text-fg/60">Code: {c.code}</div>
                                <div className="text-xs text-fg/60">Cost code: {c.costCode}</div>
                              </div>
                              <div className="text-right text-sm">
                                <div>Agreed: {formatMoney(c.agreedCents)}</div>
                                <div className="text-fg/70">Paid: {formatMoney(c.paidToDateCents)} ({(paidPct * 100).toFixed(1)}%)</div>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-md bg-muted px-2 py-1">{c.status.replaceAll("_", " ")}</span>
                              {vendorLink ? (
                                <Link className="rounded-md bg-muted px-2 py-1 underline" href={vendorLink}>Vendor invoice link</Link>
                              ) : null}
                            </div>

                            {canMutate ? (
                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                <form action={createVendorInvoiceRequest}>
                                  <input type="hidden" name="commitmentId" value={c.id} />
                                  <Button variant="secondary" className="w-full" type="submit">Generate vendor invoice link</Button>
                                </form>
                                {canComplete ? (
                                  <form action={markCommitmentCompleted}>
                                    <input type="hidden" name="commitmentId" value={c.id} />
                                    <Button className="w-full" type="submit">Mark job completed</Button>
                                  </form>
                                ) : (
                                  <Button className="w-full" disabled>Mark job completed</Button>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {tab === "draws" ? (
            <Card>
              <CardHeader>
                <CardTitle>Draws</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canCreateDraw ? (
                  <div className="space-y-3">
                    <form action={createDrawRequest} className="grid gap-2 md:grid-cols-2">
                      <input type="hidden" name="projectId" value={projectFull.id} />
                      <select name="loanId" className="h-10 rounded-md border border-border bg-bg px-3 text-sm" required>
                        {loans.map((l) => (
                          <option key={l.id} value={l.id}>{l.bank.name} • {l.name}</option>
                        ))}
                      </select>
                      <select name="templateId" className="h-10 rounded-md border border-border bg-bg px-3 text-sm" required>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.bank.name} • {t.name} v{t.version}</option>
                        ))}
                      </select>
                      <Input className="md:col-span-2" name="deliveryEmailTo" placeholder="Delivery emails (comma-separated)" />
                      <div className="md:col-span-2">
                        <Button type="submit">Create new draw</Button>
                      </div>
                    </form>
                    <div className="text-xs text-fg/60">Creating a draw opens the spreadsheet-style editor.</div>
                  </div>
                ) : null}

                {draws.length === 0 ? (
                  <p className="text-sm text-fg/70">No draw requests yet.</p>
                ) : (
                  <div className="space-y-3">
                    {draws.map((d) => (
                      <div key={d.id} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              <Link className="underline" href={`/app/banks/${d.loan.bankId}`}>{d.loan.bank.name}</Link>
                              <span className="text-fg/60">{" "}•{" "}</span>
                              <Link className="underline" href={`/app/projects/${projectFull.id}/draws/${d.id}`}>{d.loan.name}</Link>
                            </div>
                            <div className="text-xs text-fg/60">Template: {d.template.name} v{d.template.version}</div>
                          </div>
                          <div className="text-sm text-fg/70">{d.status.replaceAll("_", " ")}</div>
                        </div>

                        {d.approvedComment ? (
                          <div className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-fg/70">Banker note: {d.approvedComment}</div>
                        ) : null}

                        {canCreateDraw && d.status === "DRAFT" ? (
                          <div className="mt-3">
                            <form action={setDrawReadyForBank}>
                              <input type="hidden" name="drawRequestId" value={d.id} />
                              <Button variant="secondary" type="submit">Mark ready for banker</Button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {tab === "docs" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Permits</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {canMutate ? (
                      <form action={createPermit} className="grid gap-2 md:grid-cols-2">
                        <input type="hidden" name="projectId" value={projectFull.id} />
                        <Input name="permitType" placeholder="Permit type" required />
                        <Input name="jurisdiction" placeholder="Jurisdiction" required />
                        <Input name="permitNumber" placeholder="Permit # (optional)" />
                        <Input name="expiresAt" type="date" placeholder="Expires" />
                        <Input name="linkUrl" placeholder="Dropbox/URL (optional)" />
                        <Input name="notes" placeholder="Notes (optional)" />
                        <div className="md:col-span-2">
                          <Button variant="secondary" type="submit">Add permit</Button>
                        </div>
                      </form>
                    ) : null}

                    {permits.length === 0 ? (
                      <p className="text-sm text-fg/70">No permits tracked.</p>
                    ) : (
                      <div className="space-y-2">
                        {permits.map((p) => (
                          <div key={p.id} className="rounded-md border border-border p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{p.permitType}</div>
                                <div className="text-xs text-fg/70">{p.jurisdiction}{p.permitNumber ? ` • ${p.permitNumber}` : ""}</div>
                                <div className="mt-1 text-xs text-fg/60">Received: {fmtDateTime(p.issuedAt ?? p.createdAt)}</div>
                              </div>
                              <div className="text-right text-xs text-fg/70">{p.expiresAt ? `Expires: ${p.expiresAt.toLocaleDateString()}` : ""}</div>
                            </div>
                            {p.notes ? <div className="mt-2 whitespace-pre-wrap text-xs text-fg/60">{p.notes}</div> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tax abatements</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {canMutate ? (
                      <form action={createAbatement} className="grid gap-2 md:grid-cols-2">
                        <input type="hidden" name="projectId" value={projectFull.id} />
                        <Input name="programName" placeholder="Program name" required />
                        <Input name="termEnd" type="date" placeholder="Term ends (optional)" />
                        <Input name="linkUrl" placeholder="Dropbox/URL (optional)" />
                        <Input name="notes" placeholder="Notes (optional)" />
                        <div className="md:col-span-2">
                          <Button variant="secondary" type="submit">Add abatement</Button>
                        </div>
                      </form>
                    ) : null}

                    {abatements.length === 0 ? (
                      <p className="text-sm text-fg/70">No abatements tracked.</p>
                    ) : (
                      <div className="space-y-2">
                        {abatements.map((a) => (
                          <div key={a.id} className="rounded-md border border-border p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{a.programName}</div>
                                <div className="text-xs text-fg/70">{a.status}</div>
                                <div className="mt-1 text-xs text-fg/60">Filed: {fmtDateTime(a.createdAt)}</div>
                              </div>
                              <div className="text-right text-xs text-fg/70">{a.termEnd ? `Ends: ${a.termEnd.toLocaleDateString()}` : ""}</div>
                            </div>
                            {a.notes ? <div className="mt-2 whitespace-pre-wrap text-xs text-fg/60">{a.notes}</div> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Plans / specs</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {canMutate ? (
                      <form action={createPlanSet} className="grid gap-2 md:grid-cols-2">
                        <input type="hidden" name="projectId" value={projectFull.id} />
                        <Input name="name" placeholder="Plan set name" required />
                        <Input name="version" placeholder="Version" required />
                        <Input name="receivedAt" type="date" placeholder="Received (optional)" />
                        <Input name="linkUrl" placeholder="Dropbox/URL (optional)" />
                        <Input name="notes" placeholder="Notes (optional)" />
                        <div className="md:col-span-2">
                          <Button variant="secondary" type="submit">Add plan set</Button>
                        </div>
                      </form>
                    ) : null}

                    {planSets.length === 0 ? (
                      <div className="text-sm text-fg/70">No plan sets tracked.</div>
                    ) : (
                      <div className="space-y-2">
                        {planSets.map((ps) => (
                          <div key={ps.id} className="rounded-md border border-border p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{ps.name}</div>
                                <div className="text-xs text-fg/70">Version: {ps.version}{ps.superseded ? " • Superseded" : ""}</div>
                                <div className="mt-1 text-xs text-fg/60">Received: {fmtDateTime(ps.receivedAt ?? ps.createdAt)}</div>
                              </div>
                              <div className="text-right text-xs text-fg/60" />
                            </div>
                            {ps.notes ? <div className="mt-2 whitespace-pre-wrap text-xs text-fg/60">{ps.notes}</div> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Inspections</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {canMutate ? (
                      <form action={createInspection} className="grid gap-2 md:grid-cols-2">
                        <input type="hidden" name="projectId" value={projectFull.id} />
                        <Input name="name" placeholder="Inspection name" required />
                        <Input name="linkUrl" placeholder="Dropbox/URL (optional)" />
                        <Input name="notes" placeholder="Notes (optional)" />
                        <label className="flex items-center gap-2 text-sm text-fg/70">
                          <input name="required" type="checkbox" defaultChecked />
                          Required
                        </label>
                        <Button variant="secondary" size="sm" type="submit">Add inspection</Button>
                      </form>
                    ) : null}
                    {inspections.length === 0 ? (
                      <div className="text-sm text-fg/70">No inspections tracked.</div>
                    ) : (
                      <div className="space-y-2">
                        {inspections.map((i) => (
                          <div key={i.id} className="rounded-md border border-border p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{i.name}</div>
                                <div className="text-xs text-fg/60">
                                  {i.required ? "Required" : "Optional"}{i.completedAt ? " • Completed" : " • Pending"}
                                </div>
                                <div className="mt-1 text-xs text-fg/60">Scheduled: {fmtDateTime(i.createdAt)}</div>
                                {i.notes ? <div className="mt-1 whitespace-pre-wrap text-xs text-fg/60">{i.notes}</div> : null}
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-fg/60">{i.completedAt ? fmtDateTime(i.completedAt) : ""}</div>
                                {canMutate && !i.completedAt ? (
                                  <form action={markInspectionCompleted} className="mt-2">
                                    <input type="hidden" name="inspectionId" value={i.id} />
                                    <Button size="sm" type="submit">Mark completed</Button>
                                  </form>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Custom fields / links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {canManageProject ? (
                    <div className="rounded-md border border-border p-3">
                      <div className="mb-2 text-sm font-medium">Add new section</div>
                      <form action={createProjectCustomSection} className="grid gap-2 md:grid-cols-3">
                        <input type="hidden" name="projectId" value={projectFull.id} />
                        <Input name="title" placeholder="Section title (e.g., Violations)" required />
                        <label className="flex items-center gap-2 text-sm text-fg/70">
                          <input name="applyToAll" type="checkbox" />
                          Add to all projects
                        </label>
                        <Button size="sm" type="submit">Create section</Button>
                      </form>
                    </div>
                  ) : null}

                  {customSections.length === 0 ? (
                    <div className="text-sm text-fg/70">No custom sections yet.</div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {customSections.map((section) => (
                        <div key={section.id} className="rounded-md border border-border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{section.title}</div>
                            <div className="text-xs text-fg/60">{section.projectId ? "This project" : "All projects"}</div>
                          </div>
                          <div className="mt-2 space-y-1 text-sm">
                            {section.items.length === 0 ? (
                              <div className="text-fg/70">No items.</div>
                            ) : (
                              section.items.map((it) => (
                                <div key={it.id} className="flex items-center justify-between gap-3">
                                  <Link className="underline" href={it.url} target="_blank" rel="noreferrer">{it.title}</Link>
                                </div>
                              ))
                            )}
                          </div>

                          {canManageProject ? (
                            <form action={addProjectCustomSectionItem} className="mt-3 grid gap-2 md:grid-cols-2">
                              <input type="hidden" name="projectId" value={projectFull.id} />
                              <input type="hidden" name="sectionId" value={section.id} />
                              <Input name="title" placeholder="Item title" required />
                              <Input name="url" placeholder="URL (https://…)" required />
                              <div className="md:col-span-2">
                                <Button size="sm" variant="secondary" type="submit">Add item</Button>
                              </div>
                            </form>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {tab === "updates" ? (
            <Card>
              <CardHeader>
                <CardTitle>Project updates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canMutate ? (
                  <form action={addProjectUpdate} className="space-y-2">
                    <input type="hidden" name="projectId" value={projectFull.id} />
                    <textarea
                      name="body"
                      className="h-24 w-full rounded-md border border-border bg-bg p-3 text-sm"
                      placeholder="Today’s update…"
                      required
                    />
                    <Input name="tags" placeholder="Tags (comma-separated)" />
                    <Button type="submit">Post update</Button>
                  </form>
                ) : null}

                {updates.length === 0 ? (
                  <p className="text-sm text-fg/70">No updates yet.</p>
                ) : (
                  <div className="space-y-3">
                    {updates.map((u) => (
                      <div key={u.id} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">
                            <Link className="underline" href={`/app/users/${u.authorId}`}>{u.author.email}</Link>
                          </div>
                          <div className="text-xs text-fg/60">{fmtDateTime(u.createdAt)}</div>
                        </div>
                        <div className="mt-2 text-sm">{u.body}</div>
                        {u.tags.length > 0 ? <div className="mt-2 text-xs text-fg/60">Tags: {u.tags.join(", ")}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {tab === "history" ? (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-fg/70">Newest items first. Scroll to see the full timeline back to project start.</div>
                <div className="mt-3 space-y-2">
                  {history.slice(0, 250).map((h, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 odd:bg-muted/60 even:bg-card">
                      <div>
                        <div className="font-medium">{h.title}</div>
                        {h.by ? <div className="text-xs text-fg/60">By {h.by}</div> : null}
                        {h.detail ? <div className="text-xs text-fg/70">{h.detail}</div> : null}
                      </div>
                      <div className="whitespace-nowrap text-xs text-fg/60">{fmtDateTime(h.at)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </main>
      </div>
    </div>
  );
}
