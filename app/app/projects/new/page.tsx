import Link from "next/link";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { createLlc, createQbConnection } from "@/lib/actions/admin";
import { createProject } from "@/lib/actions/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function NewProjectPage() {
  const user = await requireUser();
  if (user.role === "FIELD_AGENT" || user.role === "BANKER") return null;

  const [llcs, qbConnections] = await Promise.all([
    prisma.lLC.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: "desc" } }),
    prisma.quickBooksConnection.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: "desc" } })
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Start New Project</h1>
          <p className="text-sm text-fg/70">Create an LLC, connect QuickBooks, then add a project address.</p>
        </div>
        <Link className="underline" href="/app/projects">Back to projects</Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import projects in bulk</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-fg/70">
          Use the master spreadsheet to import many projects/LLC identifiers at once.
          <div className="mt-2">
            <Link className="underline" href="/app/master-sheet">Open Master Spreadsheet</Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1) Create an LLC</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createLlc} className="grid gap-3 md:grid-cols-3">
            <Input name="name" placeholder="LLC name" required />
            <Input name="legalName" placeholder="Legal name (optional)" />
            <Input name="ein" placeholder="EIN (optional)" />
            <Input name="paTaxNumber" placeholder="PA tax # (optional)" />
            <div className="md:col-span-3">
              <Button type="submit">Create LLC</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {llcs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>2) Add a QuickBooks connection (placeholder)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-fg/70">
              This creates a connection record. QBO OAuth and the QBD Windows sync agent wiring are added next.
            </p>
            <form action={createQbConnection} className="grid gap-3 md:grid-cols-4">
              <select name="llcId" className="h-10 rounded-md border border-border bg-bg px-3 text-sm" required>
                {llcs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <select name="type" className="h-10 rounded-md border border-border bg-bg px-3 text-sm" required>
                <option value="QBO">QuickBooks Online</option>
                <option value="QBD">QuickBooks Desktop</option>
              </select>
              <Input name="displayName" placeholder="Display name" required />
              <Input name="qbdCompanyFileName" placeholder="QBD company file (optional)" />
              <div className="md:col-span-4">
                <Button type="submit">Create connection</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {llcs.length > 0 && qbConnections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>3) Create the project</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createProject} className="grid gap-3 md:grid-cols-3">
              <select name="llcId" className="h-10 rounded-md border border-border bg-bg px-3 text-sm" required>
                {llcs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <select name="qbConnectionId" className="h-10 rounded-md border border-border bg-bg px-3 text-sm" required>
                {qbConnections.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName} ({c.type})</option>
                ))}
              </select>
              <Input name="unitCount" type="number" placeholder="# Units (optional)" />
              <Input name="cityNumber" placeholder="City tax/city # (optional)" />

              <Input name="name" placeholder="Project name (you can rename later)" required />
              <Input name="addressLine1" placeholder="Address line 1" required />
              <Input name="addressLine2" placeholder="Address line 2 (optional)" />
              <Input name="city" placeholder="City" required />
              <Input name="state" placeholder="State" required />
              <Input name="zip" placeholder="ZIP" required />

              <div className="md:col-span-3">
                <Button type="submit">Create project</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>3) Create the project</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-fg/70">
              Create at least one LLC and one QuickBooks connection first.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

