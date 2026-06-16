import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { projectScopeWhere } from "@/lib/scope";
import { formatMoney } from "@/lib/format";
import { createReportSchedule, toggleReportSchedule } from "@/lib/actions/report-schedules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function ReportsPage() {
  const user = await requireUser();
  if (user.role === "FIELD_AGENT") redirect("/app/dashboard");
  const projectWhere = projectScopeWhere(user);

  const now = new Date();
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [commitments, commitmentAgg, drawPipeline, expiringPermits, expiringAbatements, expectedInvoicesOpen, schedules] = await Promise.all([
    prisma.commitment.findMany({
      where: { project: projectWhere },
      include: { project: true, vendor: true },
      orderBy: { updatedAt: "desc" },
      take: 50
    }),
    prisma.commitment.aggregate({
      where: { project: projectWhere },
      _sum: { agreedCents: true, paidToDateCents: true }
    }),
    prisma.drawRequest.groupBy({
      by: ["status"],
      where: { project: projectWhere },
      _count: { _all: true }
    }),
    prisma.permit.findMany({
      where: {
        project: projectWhere,
        expiresAt: { gte: now, lte: in30 }
      },
      include: { project: true },
      orderBy: { expiresAt: "asc" },
      take: 50
    }),
    prisma.abatement.findMany({
      where: {
        project: projectWhere,
        termEnd: { gte: now, lte: in30 }
      },
      include: { project: true },
      orderBy: { termEnd: "asc" },
      take: 50
    }),
    prisma.expectedInvoice.count({
      where: { orgId: user.orgId, resolvedAt: null, commitment: { project: projectWhere } }
    }),
    prisma.reportSchedule.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ]);

  const pipelineMap = new Map(drawPipeline.map((d) => [d.status, d._count._all]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-fg/70">Core reports (Phase 1): live dashboards + Excel exports.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">Portfolio KPIs</div>
              <div className="text-xs text-fg/70">Committed vs paid, draw pipeline counts, critical alerts.</div>
            </div>
            <div className="flex items-center gap-2">
              <Link className="underline" href="#portfolio-kpis">View</Link>
              <Link className="underline" href="/api/reports/portfolio-kpis">Export Excel</Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">Commitment summary</div>
              <div className="text-xs text-fg/70">Agreed vs paid ($ and %), by project/vendor.</div>
            </div>
            <div className="flex items-center gap-2">
              <Link className="underline" href="#commitment-summary">View</Link>
              <Link className="underline" href="/api/reports/commitment-summary">Export Excel</Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">Draw pipeline</div>
              <div className="text-xs text-fg/70">Draft / ready for banker / approved / funded.</div>
            </div>
            <div className="flex items-center gap-2">
              <Link className="underline" href="#draw-pipeline">View</Link>
              <Link className="underline" href="/api/reports/draw-pipeline">Export Excel</Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">Exception aging</div>
              <div className="text-xs text-fg/70">Unmatched QB txns, missing invoices for completed jobs.</div>
            </div>
            <div className="flex items-center gap-2">
              <Link className="underline" href="#exception-aging">View</Link>
              <Link className="underline" href="/api/reports/exception-aging">Export Excel</Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">Permit & abatement expirations</div>
              <div className="text-xs text-fg/70">Upcoming expirations (30 days).</div>
            </div>
            <div className="flex items-center gap-2">
              <Link className="underline" href="#permit-expirations">View</Link>
              <Link className="underline" href="/api/reports/permit-abatement-expirations">Export Excel</Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Draw pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm" id="draw-pipeline">
            <div className="flex justify-between"><span>Draft</span><span>{pipelineMap.get("DRAFT") ?? 0}</span></div>
            <div className="flex justify-between"><span>Ready for banker</span><span>{pipelineMap.get("READY_FOR_BANK_REVIEW") ?? 0}</span></div>
            <div className="flex justify-between"><span>Approved (not funded)</span><span>{pipelineMap.get("APPROVED") ?? 0}</span></div>
            <div className="flex justify-between"><span>Funded</span><span>{pipelineMap.get("FUNDED") ?? 0}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Permit expirations (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm" id="permit-expirations">
            {expiringPermits.length === 0 ? (
              <div className="text-fg/70">No expiring permits.</div>
            ) : (
              <div className="space-y-2">
                {expiringPermits.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        <Link className="underline" href={`/app/projects/${p.projectId}`}>{p.project.name}</Link>
                      </div>
                      <div className="text-fg/70">{p.permitType} • {p.jurisdiction}</div>
                    </div>
                    <div className="text-xs text-fg/70">{p.expiresAt?.toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
            {expiringAbatements.length > 0 ? (
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 text-sm font-medium">Abatements ending (30 days)</div>
                <div className="space-y-2">
                  {expiringAbatements.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          <Link className="underline" href={`/app/projects/${a.projectId}`}>{a.project.name}</Link>
                        </div>
                        <div className="text-fg/70">{a.programName} • {a.status}</div>
                      </div>
                      <div className="text-xs text-fg/70">{a.termEnd?.toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commitment summary (latest 50)</CardTitle>
        </CardHeader>
        <CardContent id="commitment-summary">
          {commitments.length === 0 ? (
            <p className="text-sm text-fg/70">No commitments yet.</p>
          ) : (
            <div className="overflow-auto rounded-md border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Agreed</th>
                    <th className="px-3 py-2">Paid</th>
                    <th className="px-3 py-2">Paid %</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commitments.map((c) => {
                    const paidPct = c.agreedCents > 0 ? c.paidToDateCents / c.agreedCents : 0;
                    return (
                      <tr key={c.id} className="odd:bg-muted/60 even:bg-card">
                        <td className="px-3 py-2">
                          <Link className="underline" href={`/app/projects/${c.projectId}`}>{c.project.name}</Link>
                        </td>
                        <td className="px-3 py-2">
                          <Link className="underline" href={`/app/vendors/${c.vendorId}`}>{c.vendor.name}</Link>
                        </td>
                        <td className="px-3 py-2">{c.code}</td>
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
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio KPIs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm" id="portfolio-kpis">
            <div className="flex justify-between"><span>Committed (agreed)</span><span>{formatMoney(commitmentAgg._sum.agreedCents ?? 0)}</span></div>
            <div className="flex justify-between"><span>Paid to date</span><span>{formatMoney(commitmentAgg._sum.paidToDateCents ?? 0)}</span></div>
            <div className="flex justify-between"><span>Expected invoices (open)</span><span>{expectedInvoicesOpen}</span></div>
            <div className="mt-2 text-xs text-fg/60">
              Export the full KPI workbook for more metrics.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exception aging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm" id="exception-aging">
            <div className="flex justify-between"><span>Expected invoices (open)</span><span>{expectedInvoicesOpen}</span></div>
            <div className="text-xs text-fg/60">
              Export includes unmatched QB transactions (if any) and expected invoices.
            </div>
            <div className="pt-2">
              <Link className="underline" href="/api/reports/exception-aging">Export exception aging (.xlsx)</Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auto reports by email (setup)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-fg/70">
            This saves schedules in the database. Background email delivery is wired in Phase 2 (AWS).
          </div>

          <form action={createReportSchedule} className="grid gap-3 md:grid-cols-4">
            <select name="reportType" className="h-10 rounded-md border border-border bg-bg px-3 text-sm" required>
              <option value="PORTFOLIO_KPIS">Portfolio KPIs</option>
              <option value="COMMITMENT_SUMMARY">Commitment summary</option>
              <option value="DRAW_PIPELINE">Draw pipeline</option>
              <option value="EXCEPTION_AGING">Exception aging</option>
              <option value="PERMIT_ABATEMENT_EXPIRATIONS">Permit & abatement expirations</option>
            </select>
            <select name="cadence" className="h-10 rounded-md border border-border bg-bg px-3 text-sm" required>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <Input name="recipients" placeholder="Recipients (comma-separated)" required />
            <Button type="submit">Add schedule</Button>
          </form>

          {schedules.length === 0 ? (
            <div className="text-sm text-fg/70">No schedules yet.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {schedules.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm odd:bg-muted/60 even:bg-card">
                  <div>
                    <div className="font-medium">{s.reportType.replaceAll("_", " ")}</div>
                    <div className="text-xs text-fg/70">{s.cadence} • {s.active ? "Active" : "Paused"}</div>
                    <div className="mt-1 text-xs text-fg/60">To: {(s.recipients ?? []).join(", ")}</div>
                  </div>
                  <form action={toggleReportSchedule}>
                    <input type="hidden" name="scheduleId" value={s.id} />
                    <Button variant="secondary" type="submit">{s.active ? "Pause" : "Enable"}</Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
