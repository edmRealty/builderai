import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PartnerDetailPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireUser();
  const { partnerId } = await params;

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: { projects: { include: { project: true }, orderBy: { createdAt: "desc" } } }
  });

  if (!partner || partner.orgId !== user.orgId) redirect("/app/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{partner.name}</h1>
          <div className="text-sm text-fg/70">{partner.email ?? ""}{partner.phone ? ` • ${partner.phone}` : ""}</div>
        </div>
        <Link className="underline" href="/app/dashboard">Back</Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {partner.projects.length === 0 ? (
            <div className="text-fg/70">No projects yet.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {partner.projects.map((pp) => (
                <div key={pp.id} className="flex items-center justify-between gap-3 px-3 py-2 odd:bg-muted/60 even:bg-card">
                  <div className="font-medium">
                    <Link className="underline" href={`/app/projects/${pp.projectId}`}>{pp.project.name}</Link>
                  </div>
                  <div className="text-xs text-fg/60">{(pp.ownershipBps / 100).toFixed(2)}%</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

