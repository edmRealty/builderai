import Link from "next/link";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { projectScopeWhere } from "@/lib/scope";
import { renameProject } from "@/lib/actions/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { ACTIVE_PROJECT_STATUSES, projectStatusFilterValues, projectStatusMeta } from "@/lib/project-status";
import { ProjectStatusBadge, ProjectStatusControl } from "./project-status-control";

const SORT_OPTIONS = [
  { value: "name_asc", label: "A–Z" },
  { value: "status_construction", label: "Status (construction first)" },
  { value: "zip_asc", label: "Zip code" },
  { value: "units_desc", label: "# Units" },
  { value: "progress_desc", label: "% Progress (high → low)" },
  { value: "progress_asc", label: "% Progress (low → high)" }
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...ACTIVE_PROJECT_STATUSES
] as const;

type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

const VIEW_OPTIONS = [
  { value: "detailed", label: "Detailed" },
  { value: "compact", label: "One line" },
  { value: "grid", label: "Grid" }
] as const;

type ViewValue = (typeof VIEW_OPTIONS)[number]["value"];

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export default async function ProjectsPage({
  searchParams
}: {
  searchParams: Promise<{ sort?: string; status?: string; view?: string; q?: string; llcId?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const sort = (sp.sort as SortValue | undefined) ?? "name_asc";
  const status = (sp.status as StatusValue | undefined) ?? "all";
  const view = (sp.view as ViewValue | undefined) ?? "detailed";
  const q = (sp.q ?? "").toString().trim();
  const llcId = (sp.llcId ?? "").toString().trim();

  const projectWhere: any = projectScopeWhere(user);
  if (status !== "all") projectWhere.status = { in: projectStatusFilterValues(status) };
  if (llcId) projectWhere.llcId = llcId;
  if (q) {
    projectWhere.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { addressLine1: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { zip: { contains: q, mode: "insensitive" } }
    ];
  }

  const [projectsRaw, llcs] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.lLC.findMany({ where: { orgId: user.orgId }, orderBy: { name: "asc" } })
  ]);

  const projectIds = projectsRaw.map((p) => p.id);
  const commitmentAgg = projectIds.length
    ? await prisma.commitment.groupBy({
      by: ["projectId"],
      where: { orgId: user.orgId, projectId: { in: projectIds } },
      _sum: { agreedCents: true, paidToDateCents: true }
    })
    : [];

  const progressByProject = new Map(
    commitmentAgg.map((row) => {
      const agreed = row._sum.agreedCents ?? 0;
      const paid = row._sum.paidToDateCents ?? 0;
      const progress = agreed > 0 ? clamp01(paid / agreed) : 0;
      return [row.projectId, { agreed, paid, progress }];
    })
  );

  const projects = [...projectsRaw].sort((a, b) => {
    if (sort === "name_asc") return a.name.localeCompare(b.name);
    if (sort === "status_construction") {
      const order: Record<string, number> = {
        LOT_ACQUIRED: 0,
        PLANNING: 1,
        UNDER_CONSTRUCTION: 2,
        COMPLETED_FOR_SALE: 3,
        FOR_SALE: 3,
        COMPLETED: 3,
        COMPLETED_FOR_RENT: 4,
        RENTAL_READY: 4
      };
      const ao = order[projectStatusMeta(a.status).value] ?? 99;
      const bo = order[projectStatusMeta(b.status).value] ?? 99;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    }
    if (sort === "zip_asc") return a.zip.localeCompare(b.zip);
    if (sort === "units_desc") return (b.unitCount ?? 0) - (a.unitCount ?? 0);
    if (sort === "progress_desc") {
      const ap = progressByProject.get(a.id)?.progress ?? 0;
      const bp = progressByProject.get(b.id)?.progress ?? 0;
      return bp - ap;
    }
    if (sort === "progress_asc") {
      const ap = progressByProject.get(a.id)?.progress ?? 0;
      const bp = progressByProject.get(b.id)?.progress ?? 0;
      return ap - bp;
    }
    return 0;
  });

  const canCreate = user.role !== "FIELD_AGENT" && user.role !== "BANKER";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-fg/70">Addresses you have access to.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="flex flex-wrap items-center gap-2">
            <Input name="q" defaultValue={q} placeholder="Search…" className="h-10 w-[220px]" />
            <select
              name="status"
              defaultValue={status}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              name="llcId"
              defaultValue={llcId}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm"
            >
              <option value="">All corps</option>
              {llcs.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <select
              name="view"
              defaultValue={view}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm"
            >
              {VIEW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={sort}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button variant="secondary" type="submit">Apply</Button>
            <Link className="text-sm underline" href="/app/projects">Clear</Link>
          </form>
          {canCreate ? (
            <Link href="/app/projects/new">
              <Button type="button">Start New Project</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {projects.length === 0 ? (
            <p className="text-sm text-fg/70">No projects yet.</p>
          ) : (
            view === "grid" ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => {
                  const prog = progressByProject.get(p.id)?.progress ?? 0;
                  return (
                    <Card key={p.id} className="hover:bg-muted/40">
                      <CardHeader>
                        <CardTitle className="text-base">
                          <Link className="underline" href={`/app/projects/${p.id}`}>{p.name}</Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="text-fg/70">{p.addressLine1}, {p.city}, {p.state} {p.zip}</div>
                        <div className="flex flex-wrap gap-2 text-xs text-fg/60">
                          <ProjectStatusBadge status={p.status} />
                          <span>Units: {p.unitCount ?? "—"}</span>
                          <span>Progress: {(prog * 100).toFixed(1)}%</span>
                        </div>
                        {canCreate ? <ProjectStatusControl projectId={p.id} status={p.status} editable={canCreate} /> : null}
                        {canCreate ? (
                          <details className="rounded-md border border-border px-2 py-1 text-xs">
                            <summary className="cursor-pointer select-none">Rename</summary>
                            <form action={renameProject} className="mt-2 space-y-2">
                              <input type="hidden" name="projectId" value={p.id} />
                              <Input name="name" defaultValue={p.name} required />
                              <Button className="w-full" size="sm" type="submit">Save</Button>
                            </form>
                          </details>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {projects.map((p) => {
                  const prog = progressByProject.get(p.id)?.progress ?? 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-3 odd:bg-muted/60 even:bg-card">
                      <div className="min-w-0">
                        <div className="font-medium">
                          <Link className="underline" href={`/app/projects/${p.id}`}>{p.name}</Link>
                        </div>
                        <div className="text-sm text-fg/70">
                          {p.addressLine1}, {p.city}, {p.state} {p.zip}
                        </div>
                        {view === "detailed" ? (
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-fg/60">
                            <ProjectStatusBadge status={p.status} />
                            <span>Units: {p.unitCount ?? "—"}</span>
                            <span>Progress: {(prog * 100).toFixed(1)}%</span>
                            <span>
                              Paid/Committed: {formatMoney(progressByProject.get(p.id)?.paid ?? 0)} / {formatMoney(progressByProject.get(p.id)?.agreed ?? 0)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <ProjectStatusControl projectId={p.id} status={p.status} editable={canCreate} />
                        {canCreate ? (
                          <details className="rounded-md border border-border px-2 py-1 text-xs">
                            <summary className="cursor-pointer select-none">Rename</summary>
                            <form action={renameProject} className="mt-2 space-y-2">
                              <input type="hidden" name="projectId" value={p.id} />
                              <Input name="name" defaultValue={p.name} required />
                              <Button className="w-full" size="sm" type="submit">Save</Button>
                            </form>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
