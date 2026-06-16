import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { bankerApproveDraw, bankerRejectDraw, bankerRequestInfo } from "@/lib/actions/draws";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function BankerPortalPage() {
  const user = await requireUser();
  if (user.role !== "BANKER") redirect("/app/dashboard");

  const loans = await prisma.loanBanker.findMany({
    where: { orgId: user.orgId, userId: user.id },
    include: { loan: { include: { project: true, bank: true } } },
    orderBy: { id: "desc" }
  });

  const loanIds = loans.map((l) => l.loanId);

  const draws = await prisma.drawRequest.findMany({
    where: {
      orgId: user.orgId,
      loanId: { in: loanIds },
      status: { in: ["READY_FOR_BANK_REVIEW", "NEEDS_INFO"] }
    },
    include: { project: true, loan: { include: { bank: true } }, lineItems: true },
    orderBy: { updatedAt: "desc" },
    take: 50
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Banker Portal</h1>
        <p className="text-sm text-fg/70">Projects and draws assigned to you.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned loans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {loans.length === 0 ? (
            <p className="text-fg/70">No loans assigned.</p>
          ) : (
            <div className="space-y-2">
              {loans.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 odd:bg-muted/60 even:bg-card">
                  <div>
                    <div className="font-medium">
                      <Link className="underline" href={`/app/projects/${l.loan.projectId}`}>{l.loan.project.name}</Link>
                    </div>
                    <div className="text-fg/70">
                      <Link className="underline" href={`/app/banks/${l.loan.bankId}`}>{l.loan.bank.name}</Link>
                      <span className="text-fg/60">{" "}•{" "}</span>
                      <span>{l.loan.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Draws ready for review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {draws.length === 0 ? (
            <p className="text-sm text-fg/70">No draws waiting for review.</p>
          ) : (
            draws.map((d) => (
              <div key={d.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      <Link className="underline" href={`/app/projects/${d.projectId}`}>{d.project.name}</Link>
                    </div>
                    <div className="text-sm text-fg/70">
                      <Link className="underline" href={`/app/banks/${d.loan.bankId}`}>{d.loan.bank.name}</Link>
                      <span className="text-fg/60">{" "}•{" "}</span>
                      <span>{d.loan.name}</span>
                      <span className="text-fg/60">{" "}•{" "}</span>
                      <Link className="underline" href={`/app/projects/${d.projectId}/draws/${d.id}`}>Open draw spreadsheet</Link>
                    </div>
                    <div className="text-xs text-fg/60">Status: {d.status.replaceAll("_", " ")}</div>
                  </div>
                </div>

                <div className="mt-3 overflow-auto rounded-md border border-border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-left">
                      <tr>
                        <th className="px-3 py-2">Line</th>
                        <th className="px-3 py-2">% Complete</th>
                        <th className="px-3 py-2">This draw</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {d.lineItems.slice(0, 20).map((li) => (
                        <tr key={li.id} className="odd:bg-muted/60 even:bg-card">
                          <td className="px-3 py-2">{li.label}</td>
                          <td className="px-3 py-2">{li.percentComplete ?? 0}%</td>
                          <td className="px-3 py-2">${((li.thisDrawCents ?? 0) / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <form action={bankerApproveDraw} className="space-y-2">
                    <input type="hidden" name="drawRequestId" value={d.id} />
                    <Input name="comment" placeholder="Comment (optional)" />
                    <Button className="w-full" type="submit">Approve</Button>
                  </form>
                  <form action={bankerRequestInfo} className="space-y-2">
                    <input type="hidden" name="drawRequestId" value={d.id} />
                    <Input name="comment" placeholder="What’s missing?" required />
                    <Button variant="secondary" className="w-full" type="submit">Request info</Button>
                  </form>
                  <form action={bankerRejectDraw} className="space-y-2">
                    <input type="hidden" name="drawRequestId" value={d.id} />
                    <Input name="comment" placeholder="Reason" required />
                    <Button variant="danger" className="w-full" type="submit">Reject</Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
