import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const viewer = await requireUser();
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      assignedProjects: { include: { project: true }, orderBy: { createdAt: "desc" } },
      bankerLoans: { include: { loan: { include: { project: true, bank: true } } }, orderBy: { loan: { createdAt: "desc" } } }
    }
  });

  if (!user || user.orgId !== viewer.orgId) redirect("/app/users");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{user.name ?? user.email}</h1>
          <div className="text-sm text-fg/70">{user.email}{user.phone ? ` • ${user.phone}` : ""}</div>
          <div className="mt-1 text-xs text-fg/60">Role: {user.role.replaceAll("_", " ")}</div>
        </div>
        <Link className="underline" href="/app/users">Back to users</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assigned projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {user.assignedProjects.length === 0 ? (
              <div className="text-fg/70">None.</div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {user.assignedProjects.map((a) => (
                  <div key={a.id} className="px-3 py-2 odd:bg-muted/60 even:bg-card">
                    <div className="font-medium">
                      <Link className="underline" href={`/app/projects/${a.projectId}`}>{a.project.name}</Link>
                    </div>
                    <div className="text-xs text-fg/70">{a.project.status.replaceAll("_", " ")}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Banker assignments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {user.bankerLoans.length === 0 ? (
              <div className="text-fg/70">None.</div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {user.bankerLoans.map((b) => (
                  <div key={b.id} className="px-3 py-2 odd:bg-muted/60 even:bg-card">
                    <div className="font-medium">
                      <Link className="underline" href={`/app/projects/${b.loan.projectId}`}>{b.loan.project.name}</Link>
                    </div>
                    <div className="text-xs text-fg/70">{b.loan.bank.name} • {b.loan.name}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
