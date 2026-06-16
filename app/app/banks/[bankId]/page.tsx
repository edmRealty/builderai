import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { BankCrmActions } from "../bank-crm-actions";

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

function fmtDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default async function BankDetailPage({ params }: { params: Promise<{ bankId: string }> }) {
  const user = await requireUser();
  const { bankId } = await params;

  const bank = await prisma.bank.findUnique({
    where: { id: bankId },
    include: {
      loans: {
        include: { project: true, bankers: { include: { user: true } } },
        orderBy: { updatedAt: "desc" }
      },
      communications: {
        include: { project: true, createdBy: true },
        orderBy: { createdAt: "desc" },
        take: 50
      }
    }
  });

  if (!bank || bank.orgId !== user.orgId) redirect("/app/banks");

  const projectIds = [...new Set(bank.loans.map((loan) => loan.projectId))];
  const totalLoanAmount = bank.loans.reduce((sum, loan) => sum + (loan.totalLoanCents ?? 0), 0);
  const balanceDue = bank.loans.reduce((sum, loan) => {
    if (loan.totalLoanCents == null) return sum;
    return sum + Math.max(loan.totalLoanCents - loan.paidToDateCents, 0);
  }, 0);
  const hasLoanTotals = bank.loans.some((loan) => loan.totalLoanCents != null);
  const communicationLabels = { CALL: "Call", TEXT: "Text", EMAIL: "Email" } as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{bank.name}</h1>
          <div className="text-sm text-fg/70">
            {bank.contactName ?? "No contact name"}{bank.contactPhone ? ` - ${bank.contactPhone}` : ""}{bank.contactEmail ? ` - ${bank.contactEmail}` : ""}
          </div>
        </div>
        <Link className="underline" href="/app/banks">Back to banks</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CRM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <BankCrmActions bankId={bank.id} phone={bank.contactPhone} email={bank.contactEmail} projectIds={projectIds} />
            <div className="text-xs text-fg/60">
              {projectIds.length === 0 ? "Communications log to this bank only." : `Communications also log to ${projectIds.length} project timeline${projectIds.length === 1 ? "" : "s"}.`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total loan amount</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {hasLoanTotals ? formatMoney(totalLoanAmount) : "-"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Balance due</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {hasLoanTotals ? formatMoney(balanceDue) : "-"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loan addresses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {bank.loans.length === 0 ? (
            <div className="text-fg/70">No linked project addresses.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {bank.loans.map((loan) => (
                <div key={loan.id} className="p-3 odd:bg-muted/60 even:bg-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        <Link className="underline" href={`/app/projects/${loan.projectId}`}>{loan.project.name}</Link>
                      </div>
                      <div className="text-xs text-fg/70">{projectAddress(loan.project)}</div>
                      <div className="mt-1 text-xs text-fg/60">{loan.name}{loan.loanNumber ? ` - ${loan.loanNumber}` : ""}</div>
                    </div>
                    <div className="text-right text-xs text-fg/70">
                      <div>Total: {loan.totalLoanCents ? formatMoney(loan.totalLoanCents) : "-"}</div>
                      <div>Paid: {formatMoney(loan.paidToDateCents)}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-fg/60">
                    Bankers: {loan.bankers.length === 0 ? "-" : loan.bankers.map((b) => b.user.email).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CRM communications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {bank.communications.length === 0 ? (
            <div className="text-fg/70">No communications logged yet.</div>
          ) : (
            <div className="space-y-2">
              {bank.communications.map((comm) => (
                <div key={comm.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{communicationLabels[comm.type]}</div>
                    <div className="text-xs text-fg/60">{fmtDateTime(comm.createdAt)}</div>
                  </div>
                  <div className="mt-1 text-xs text-fg/70">
                    {comm.project ? (
                      <Link className="underline" href={`/app/projects/${comm.projectId}?tab=history`}>{comm.project.name}</Link>
                    ) : (
                      "Bank-only"
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
    </div>
  );
}
