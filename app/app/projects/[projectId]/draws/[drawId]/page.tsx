import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import { requireProject } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { updateDrawLineItem, setDrawReadyForBank } from "@/lib/actions/draws";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export default async function DrawSpreadsheetPage({
  params
}: {
  params: Promise<{ projectId: string; drawId: string }>;
}) {
  const { projectId, drawId } = await params;
  const user = await requireUser();

  const project = await requireProject(user, projectId);

  const draw = await prisma.drawRequest.findUnique({
    where: { id: drawId },
    include: {
      project: true,
      loan: { include: { bank: true } },
      template: true,
      lineItems: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!draw || draw.orgId !== user.orgId || draw.projectId !== project.id) {
    redirect(`/app/projects/${project.id}?tab=draws`);
  }

  const drawsForLoan = await prisma.drawRequest.findMany({
    where: { orgId: user.orgId, loanId: draw.loanId },
    select: { id: true },
    orderBy: { createdAt: "asc" }
  });
  const drawNumber = Math.max(1, drawsForLoan.findIndex((d) => d.id === draw.id) + 1);

  const canEdit = ["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role) && draw.status === "DRAFT" && !draw.lockedAt;

  const totals = draw.lineItems.reduce(
    (acc, li) => {
      acc.scheduled += li.scheduledCents ?? 0;
      acc.previous += li.previousDrawCents ?? 0;
      acc.thisDraw += li.thisDrawCents ?? 0;
      acc.retainage += li.retainageCents ?? 0;
      return acc;
    },
    { scheduled: 0, previous: 0, thisDraw: 0, retainage: 0 }
  );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-fg/60">Draw spreadsheet</div>
            <h1 className="text-xl font-semibold">Draw #{drawNumber}</h1>
            <div className="text-sm text-fg/70">
              {draw.loan.bank.name} • {draw.project.name} • {fmtDate(draw.createdAt)}
            </div>
            <div className="mt-1 text-xs text-fg/60">
              Template: {draw.template.name} v{draw.template.version} • Status: {draw.status.replaceAll("_", " ")}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/app/projects/${project.id}?tab=draws`}>
              <Button variant="secondary" type="button">Back</Button>
            </Link>
            {canEdit ? (
              <form action={setDrawReadyForBank}>
                <input type="hidden" name="drawRequestId" value={draw.id} />
                <Button type="submit">Mark ready for banker</Button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative left-1/2 right-1/2 w-screen -ml-[50vw] -mr-[50vw]">
        <div className="px-3 md:px-6">
          <div className="overflow-auto rounded-md border border-border bg-bg">
            <table className="min-w-[1400px] text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-left">
                <tr>
                  <th className="px-3 py-2">Line</th>
                  <th className="px-3 py-2">Cost code</th>
                  <th className="px-3 py-2 text-right">Scheduled</th>
                  <th className="px-3 py-2 text-right">Previous</th>
                  <th className="px-3 py-2 text-right">This draw</th>
                  <th className="px-3 py-2 text-right">Retainage</th>
                  <th className="px-3 py-2 text-right">% complete</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  {canEdit ? <th className="px-3 py-2 text-right">Save</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {draw.lineItems.map((li) => {
                  const scheduled = li.scheduledCents ?? 0;
                  const previous = li.previousDrawCents ?? 0;
                  const thisDraw = li.thisDrawCents ?? 0;
                  const retainage = li.retainageCents ?? 0;
                  const balance = Math.max(0, scheduled - previous - thisDraw);
                  const formId = `li-${li.id}`;
                  return (
                    <tr key={li.id} className="odd:bg-muted/60 even:bg-card hover:bg-muted/80">
                      <td className="px-3 py-2 font-medium">{li.label}</td>
                      <td className="px-3 py-2">{li.costCode ?? ""}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(scheduled)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(previous)}</td>
                      <td className="px-3 py-2 text-right">
                        {canEdit ? (
                          <Input
                            name="thisDraw"
                            form={formId}
                            defaultValue={String((thisDraw / 100).toFixed(2))}
                            className="h-8 w-32 text-right"
                          />
                        ) : (
                          formatMoney(thisDraw)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canEdit ? (
                          <Input
                            name="retainage"
                            form={formId}
                            defaultValue={String((retainage / 100).toFixed(2))}
                            className="h-8 w-28 text-right"
                          />
                        ) : (
                          formatMoney(retainage)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canEdit ? (
                          <Input
                            name="percentComplete"
                            form={formId}
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={li.percentComplete ?? 0}
                            className="h-8 w-24 text-right"
                          />
                        ) : (
                          `${li.percentComplete ?? 0}%`
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{formatMoney(balance)}</td>
                      {canEdit ? (
                        <td className="px-3 py-2 text-right">
                          <form id={formId} action={updateDrawLineItem} className="flex justify-end">
                            <input type="hidden" name="lineItemId" value={li.id} />
                            <Button size="sm" variant="secondary" type="submit">Save</Button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-muted">
                <tr>
                  <td className="px-3 py-2 font-medium" colSpan={2}>Totals</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(totals.scheduled)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(totals.previous)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(totals.thisDraw)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(totals.retainage)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  {canEdit ? <td className="px-3 py-2" /> : null}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-2 text-xs text-fg/60">
            Demo editor: edit rows while the draw is in DRAFT. Once marked ready/approved, it becomes read‑only.
          </div>
        </div>
      </div>
    </div>
  );
}
