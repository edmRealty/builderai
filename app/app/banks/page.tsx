import Link from "next/link";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { BankCrmActions } from "./bank-crm-actions";
import { AddBankPanel } from "./add-bank-panel";

function projectAddress(project: {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
}) {
  return [project.addressLine1, project.addressLine2, `${project.city}, ${project.state} ${project.zip}`]
    .filter(Boolean)
    .join(", ");
}

export default async function BanksPage() {
  const user = await requireUser();
  const canManage = user.role === "ADMIN" || user.role === "OWNER";

  const [banks, projects] = await Promise.all([
    prisma.bank.findMany({
      where: { orgId: user.orgId },
      include: {
        loans: {
          include: { project: true },
          orderBy: { updatedAt: "desc" }
        }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.project.findMany({
      where: { orgId: user.orgId },
      select: {
        id: true,
        name: true,
        addressLine1: true,
        city: true,
        state: true,
        zip: true
      }
    })
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Banks</h1>
          <p className="text-sm text-fg/70">CRM directory for lender contacts and project loan exposure.</p>
        </div>
        {canManage ? <AddBankPanel projects={projects} /> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bank list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {banks.length === 0 ? (
            <p className="text-sm text-fg/70">No banks yet.</p>
          ) : (
            <div className="overflow-auto rounded-md border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-3 py-2">Bank</th>
                    <th className="px-3 py-2">CRM</th>
                    <th className="px-3 py-2">Loan addresses</th>
                    <th className="px-3 py-2 text-right">Total loan amount</th>
                    <th className="px-3 py-2 text-right">Balance due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {banks.map((bank) => {
                    const projectSummaries = [...bank.loans.reduce((map, loan) => {
                      const current = map.get(loan.projectId) ?? {
                        project: loan.project,
                        loanCount: 0,
                        totalLoanAmount: 0,
                        balanceDue: 0,
                        hasLoanTotal: false
                      };
                      current.loanCount += 1;
                      if (loan.totalLoanCents != null) {
                        current.hasLoanTotal = true;
                        current.totalLoanAmount += loan.totalLoanCents;
                        current.balanceDue += Math.max(loan.totalLoanCents - loan.paidToDateCents, 0);
                      }
                      map.set(loan.projectId, current);
                      return map;
                    }, new Map<string, {
                      project: (typeof bank.loans)[number]["project"];
                      loanCount: number;
                      totalLoanAmount: number;
                      balanceDue: number;
                      hasLoanTotal: boolean;
                    }>()).values()];
                    const projectIds = projectSummaries.map((summary) => summary.project.id);
                    const totalLoanAmount = bank.loans.reduce((sum, loan) => sum + (loan.totalLoanCents ?? 0), 0);
                    const balanceDue = bank.loans.reduce((sum, loan) => {
                      if (loan.totalLoanCents == null) return sum;
                      return sum + Math.max(loan.totalLoanCents - loan.paidToDateCents, 0);
                    }, 0);
                    const hasLoanTotals = bank.loans.some((loan) => loan.totalLoanCents != null);

                    return (
                      <tr key={bank.id} className="align-top odd:bg-muted/60 even:bg-card">
                        <td className="min-w-56 px-3 py-3">
                          <div className="font-medium">
                            <Link className="underline" href={`/app/banks/${bank.id}`}>{bank.name}</Link>
                          </div>
                          <div className="text-sm text-fg/70">{bank.contactName ?? "No contact name"}</div>
                          <div className="text-xs text-fg/60">
                            {bank.contactPhone ?? "No phone"}{bank.contactEmail ? ` - ${bank.contactEmail}` : ""}
                          </div>
                        </td>
                        <td className="min-w-36 px-3 py-3">
                          <BankCrmActions bankId={bank.id} phone={bank.contactPhone} email={bank.contactEmail} projectIds={projectIds} />
                          <div className="mt-1 text-xs text-fg/50">
                            {projectIds.length === 0 ? "Bank-only log" : projectIds.length === 1 ? "Logs to 1 project" : `Logs to ${projectIds.length} projects`}
                          </div>
                        </td>
                        <td className="min-w-80 px-3 py-3">
                          {projectSummaries.length === 0 ? (
                            <span className="text-xs text-fg/50">No linked project addresses</span>
                          ) : (
                            <div className="space-y-2">
                              {projectSummaries.slice(0, 3).map((summary) => (
                                <div key={summary.project.id} className="rounded-md border border-border bg-bg px-2 py-1.5">
                                  <Link className="font-medium underline" href={`/app/projects/${summary.project.id}`}>{summary.project.name}</Link>
                                  <div className="text-xs text-fg/60">{projectAddress(summary.project)}</div>
                                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg/70">
                                    <span>Loan: {summary.hasLoanTotal ? formatMoney(summary.totalLoanAmount) : "-"}</span>
                                    <span>Balance: {summary.hasLoanTotal ? formatMoney(summary.balanceDue) : "-"}</span>
                                    {summary.loanCount > 1 ? <span>{summary.loanCount} loans</span> : null}
                                  </div>
                                </div>
                              ))}
                              {projectSummaries.length > 3 ? (
                                <div className="text-xs text-fg/50">+{projectSummaries.length - 3} more project addresses with balances</div>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="min-w-36 px-3 py-3 text-right font-medium">
                          {hasLoanTotals ? formatMoney(totalLoanAmount) : "-"}
                        </td>
                        <td className="min-w-32 px-3 py-3 text-right font-medium">
                          {hasLoanTotals ? formatMoney(balanceDue) : "-"}
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
