import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { decryptString } from "@/lib/crypto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addLlcDocument, addLlcPartner, removeLlcPartner, updateLlcDetails, updateLlcPartnerOwnership } from "@/lib/actions/llcs";

function safeDecrypt(value: string | null) {
  if (!value) return "";
  try {
    return decryptString(value);
  } catch {
    return "";
  }
}

export default async function LlcDetailPage({ params }: { params: Promise<{ llcId: string }> }) {
  const user = await requireUser();
  const { llcId } = await params;

  const llc = await prisma.lLC.findUnique({
    where: { id: llcId },
    include: {
      qbConnections: { orderBy: { createdAt: "asc" } },
      projects: { orderBy: { createdAt: "desc" } },
      documents: { include: { createdBy: true }, orderBy: { createdAt: "desc" }, take: 50 },
      partners: { include: { partner: true }, orderBy: { updatedAt: "desc" } }
    }
  });

  if (!llc || llc.orgId !== user.orgId) redirect("/app/llcs");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{llc.name}</h1>
          <div className="text-sm text-fg/70">{llc.legalName ?? ""}</div>
        </div>
        <Link className="underline" href="/app/llcs">Back to corp</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Corp details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-fg/70">EIN</span><span className="font-medium">{safeDecrypt(llc.einEnc) || "—"}</span></div>
            <div className="flex justify-between"><span className="text-fg/70">Established</span><span className="font-medium">{llc.establishedAt ? llc.establishedAt.toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between gap-3">
              <span className="text-fg/70">OneDrive</span>
              {llc.oneDriveFolderUrl ? (
                <Link className="underline" href={llc.oneDriveFolderUrl} target="_blank" rel="noreferrer">Open folder</Link>
              ) : (
                <span className="font-medium">—</span>
              )}
            </div>

            {["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role) ? (
              <div className="mt-3 rounded-md border border-border p-3">
                <div className="mb-2 text-sm font-medium">Edit corp details</div>
                <form action={updateLlcDetails} className="grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="llcId" value={llc.id} />
                  <Input name="legalName" defaultValue={llc.legalName ?? ""} placeholder="Legal name" />
                  <Input name="establishedAt" type="date" defaultValue={llc.establishedAt ? llc.establishedAt.toISOString().slice(0, 10) : ""} />
                  <div className="md:col-span-2">
                    <Input name="oneDriveFolderUrl" defaultValue={llc.oneDriveFolderUrl ?? ""} placeholder="OneDrive folder URL (https://…)" />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button size="sm" type="submit">Save</Button>
                  </div>
                </form>
                <div className="mt-2 text-xs text-fg/60">PA tax # is tracked at the project level (identifiers).</div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QuickBooks connections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {llc.qbConnections.length === 0 ? (
              <div className="text-fg/70">None.</div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {llc.qbConnections.map((c) => (
                  <div key={c.id} className="px-3 py-2 odd:bg-muted/60 even:bg-card">
                    <div className="font-medium">{c.displayName}</div>
                    <div className="text-xs text-fg/70">{c.type} • {c.status}</div>
                    {c.type === "QBD" && c.qbdCompanyFileName ? (
                      <div className="text-xs text-fg/60">Company file: {c.qbdCompanyFileName}</div>
                    ) : null}
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
            <CardTitle>Attachments / links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {llc.documents.length === 0 ? (
              <div className="text-fg/70">No attachments yet.</div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {llc.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 odd:bg-muted/60 even:bg-card">
                    <div>
                      <div className="font-medium">
                        <Link className="underline" href={d.url} target="_blank" rel="noreferrer">{d.title}</Link>
                      </div>
                      <div className="text-xs text-fg/60">Added by {d.createdBy.name ?? d.createdBy.email} • {d.createdAt.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role) ? (
              <div className="rounded-md border border-border p-3">
                <div className="mb-2 text-sm font-medium">Add attachment link</div>
                <form action={addLlcDocument} className="grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="llcId" value={llc.id} />
                  <Input name="title" placeholder="Title" required />
                  <Input name="url" placeholder="https://…" required />
                  <div className="md:col-span-2 flex justify-end">
                    <Button size="sm" type="submit">Add</Button>
                  </div>
                </form>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Partners</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(() => {
              const totalBps = llc.partners.reduce((acc, p) => acc + p.ownershipBps, 0);
              const ok = totalBps === 10000;
              return (
                <div className={`rounded-md border px-3 py-2 text-xs ${ok ? "border-border bg-muted/30 text-fg/70" : "border-danger bg-danger/10 text-danger"}`}>
                  Total ownership: {(totalBps / 100).toFixed(2)}% {ok ? "" : "(should be 100.00%)"}
                </div>
              );
            })()}

            {llc.partners.length === 0 ? (
              <div className="text-fg/70">No partners yet.</div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {llc.partners.map((lp) => (
                  <div key={lp.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 odd:bg-muted/60 even:bg-card">
                    <div>
                      <div className="font-medium">
                        <Link className="underline" href={`/app/partners/${lp.partnerId}`}>{lp.partner.name}</Link>
                      </div>
                      <div className="text-xs text-fg/60">{lp.partner.email ?? ""}{lp.partner.phone ? ` • ${lp.partner.phone}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={updateLlcPartnerOwnership} className="flex items-center gap-2">
                        <input type="hidden" name="llcPartnerId" value={lp.id} />
                        <Input name="ownershipPct" type="number" step="0.01" min={0} max={100} defaultValue={(lp.ownershipBps / 100).toFixed(2)} className="h-8 w-24 text-right" required />
                        <Button size="sm" variant="secondary" type="submit">Save</Button>
                      </form>
                      {["ADMIN", "OWNER"].includes(user.role) ? (
                        <form action={removeLlcPartner}>
                          <input type="hidden" name="llcPartnerId" value={lp.id} />
                          <Button size="sm" variant="danger" type="submit">Remove</Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role) ? (
              <div className="rounded-md border border-border p-3">
                <div className="mb-2 text-sm font-medium">Add a partner</div>
                <form action={addLlcPartner} className="grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="llcId" value={llc.id} />
                  <Input name="name" placeholder="Partner name" required />
                  <Input name="ownershipPct" type="number" step="0.01" min={0} max={100} placeholder="Ownership % (required)" required />
                  <Input name="email" type="email" placeholder="Email (optional)" />
                  <Input name="phone" placeholder="Phone (optional)" />
                  <div className="md:col-span-2 flex justify-end">
                    <Button size="sm" type="submit">Add partner</Button>
                  </div>
                </form>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {llc.projects.length === 0 ? (
            <div className="text-sm text-fg/70">No projects for this LLC.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {llc.projects.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 odd:bg-muted/60 even:bg-card">
                  <div>
                    <div className="font-medium">
                      <Link className="underline" href={`/app/projects/${p.id}`}>{p.name}</Link>
                    </div>
                    <div className="text-sm text-fg/70">{p.addressLine1}, {p.city}, {p.state} {p.zip}</div>
                  </div>
                  <div className="text-sm text-fg/70">{p.status.replaceAll("_", " ")}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
