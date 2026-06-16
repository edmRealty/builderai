import Link from "next/link";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { decryptString } from "@/lib/crypto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createLlc } from "@/lib/actions/admin";
import { deleteLlc, renameLlc } from "@/lib/actions/llcs";

function safeDecrypt(value: string | null) {
  if (!value) return "";
  try {
    return decryptString(value);
  } catch {
    return "";
  }
}

const SORT_OPTIONS = [
  { value: "name_asc", label: "A–Z" },
  { value: "projects_desc", label: "# Projects" },
  { value: "created_desc", label: "Newest" }
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const VIEW_OPTIONS = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" }
] as const;

type ViewValue = (typeof VIEW_OPTIONS)[number]["value"];

export default async function LlcsPage({ searchParams }: { searchParams: Promise<{ sort?: string; view?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const sort = (sp.sort as SortValue | undefined) ?? "name_asc";
  const view = (sp.view as ViewValue | undefined) ?? "list";
  const error = (sp.error ?? "").toString();

  const llcs = await prisma.lLC.findMany({
    where: { orgId: user.orgId },
    include: { projects: { select: { id: true } }, qbConnections: { select: { id: true } } },
    orderBy: { createdAt: "desc" }
  });

  const llcsSorted = [...llcs].sort((a, b) => {
    if (sort === "name_asc") return a.name.localeCompare(b.name);
    if (sort === "projects_desc") return b.projects.length - a.projects.length;
    if (sort === "created_desc") return b.createdAt.getTime() - a.createdAt.getTime();
    return 0;
  });

  const canManage = user.role === "ADMIN" || user.role === "OWNER";
  const canCreate = user.role !== "FIELD_AGENT" && user.role !== "BANKER";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Corp</h1>
          <p className="text-sm text-fg/70">Legal entities used to group projects and QuickBooks connections.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-fg/70" htmlFor="sort">Sort</label>
            <select id="sort" name="sort" defaultValue={sort} className="h-10 rounded-md border border-border bg-bg px-3 text-sm">
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label className="text-sm text-fg/70" htmlFor="view">View</label>
            <select id="view" name="view" defaultValue={view} className="h-10 rounded-md border border-border bg-bg px-3 text-sm">
              {VIEW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button variant="secondary" type="submit">Apply</Button>
          </form>
          <Link href="/app/llcs/order">
            <Button variant="secondary" type="button">Order New LLC</Button>
          </Link>
          {canCreate ? (
            <details className="relative">
              <summary className="list-none marker:hidden">
                <Button type="button">Add an LLC</Button>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-[min(860px,calc(100vw-2rem))] rounded-md border border-border bg-card p-3 shadow">
                <form action={createLlc} className="grid gap-3 md:grid-cols-4">
                  <Input name="name" placeholder="Display name" required />
                  <Input name="legalName" placeholder="Legal name (optional)" />
                  <Input name="ein" placeholder="EIN (optional)" />
                  <Input name="paTaxNumber" placeholder="PA tax # (optional; legacy)" />
                  <div className="md:col-span-4 flex items-center justify-end">
                    <Button type="submit">Create</Button>
                  </div>
                </form>
              </div>
            </details>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
          {decodeURIComponent(error)}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Corp list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {llcsSorted.length === 0 ? (
            <div className="text-sm text-fg/70">No LLCs yet.</div>
          ) : view === "grid" ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {llcsSorted.map((l) => (
                <Card key={l.id} className="hover:bg-muted/40">
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link className="underline" href={`/app/llcs/${l.id}`}>{l.name}</Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="text-fg/70">{l.legalName ?? ""}</div>
                    <div className="text-xs text-fg/60">EIN: {safeDecrypt(l.einEnc) || "—"}</div>
                    <div className="text-xs text-fg/60">
                      {l.projects.length} projects • {l.qbConnections.length} QB connections
                    </div>
                    {canManage ? (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <details className="rounded-md border border-border px-2 py-1 text-xs">
                          <summary className="cursor-pointer select-none">Rename</summary>
                          <form action={renameLlc} className="mt-2 space-y-2">
                            <input type="hidden" name="llcId" value={l.id} />
                            <Input name="name" defaultValue={l.name} required />
                            <Button className="w-full" size="sm" type="submit">Save</Button>
                          </form>
                        </details>
                        <form action={deleteLlc}>
                          <input type="hidden" name="llcId" value={l.id} />
                          <Button variant="danger" size="sm" type="submit">Remove</Button>
                        </form>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {llcsSorted.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 odd:bg-muted/60 even:bg-card">
                  <div>
                    <div className="font-medium">
                      <Link className="underline" href={`/app/llcs/${l.id}`}>{l.name}</Link>
                    </div>
                    <div className="text-sm text-fg/70">{l.legalName ?? ""}</div>
                    <div className="mt-1 text-xs text-fg/60">
                      EIN: {safeDecrypt(l.einEnc) || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-fg/70">
                    <div>{l.projects.length} projects • {l.qbConnections.length} QB connections</div>
                    {canManage ? (
                      <>
                        <details className="rounded-md border border-border px-2 py-1 text-xs">
                          <summary className="cursor-pointer select-none">Rename</summary>
                          <form action={renameLlc} className="mt-2 space-y-2">
                            <input type="hidden" name="llcId" value={l.id} />
                            <Input name="name" defaultValue={l.name} required />
                            <Button className="w-full" size="sm" type="submit">Save</Button>
                          </form>
                        </details>
                        <form action={deleteLlc}>
                          <input type="hidden" name="llcId" value={l.id} />
                          <Button variant="danger" size="sm" type="submit">Remove</Button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
