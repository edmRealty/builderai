import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/require-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportForm } from "@/app/app/master-sheet/import-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { restoreFromBackup } from "@/lib/actions/backup";

export default async function MasterSheetPage({ searchParams }: { searchParams: Promise<{ restoreError?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const restoreError = (sp.restoreError ?? "").toString();

  const canView = ["ADMIN", "OWNER", "ACCOUNTANT", "PROJECT_MANAGER"].includes(user.role);
  if (!canView) redirect("/app/dashboard");

  const canImport = ["ADMIN", "OWNER"].includes(user.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Export / Import</h1>
        <p className="text-sm text-fg/70">
          Export spreadsheets, import bulk updates, and create a full backup/restore file.
        </p>
      </div>

      {restoreError ? (
        <div className="rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
          {decodeURIComponent(restoreError)}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Download / Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <Link className="underline" href="/api/master-sheet/template">Download template (.xlsx)</Link>
          </div>
          <div>
            <Link className="underline" href="/api/master-sheet/export">Export current master spreadsheet (.xlsx)</Link>
          </div>
          <div className="text-xs text-fg/60">
            Columns include address fields, LLC EIN + PA tax #, and the project city number.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup / Restore (single file)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="text-fg/70">
            Use this to protect against hosting deletion/hacks/non-payment. Keep your backup file and passphrase somewhere safe.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="mb-2 font-medium">Create backup</div>
              <form action="/api/backup/export" method="post" className="space-y-2">
                <Input name="passphrase" type="password" placeholder="Encryption passphrase (8+ chars)" required />
                <label className="flex items-center gap-2 text-xs text-fg/70">
                  <input type="checkbox" name="encrypted" value="true" defaultChecked />
                  Encrypt backup (recommended)
                </label>
                <Button type="submit">Download backup file</Button>
              </form>
              <div className="mt-2 text-xs text-fg/60">File type: `.mfcmsbackup` (stores all org data, not sessions).</div>
            </div>

            <div className="rounded-md border border-border p-3">
              <div className="mb-2 font-medium">Restore backup</div>
              <form action={restoreFromBackup} className="space-y-2">
                <input type="file" name="backupFile" accept=".mfcmsbackup,application/octet-stream,application/json" required />
                <Input name="passphrase" type="password" placeholder="Passphrase (if encrypted)" />
                <select name="mode" className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm" defaultValue="replace">
                  <option value="replace">Replace current org data</option>
                  <option value="merge">Merge into current org</option>
                </select>
                <Button variant="danger" type="submit">Restore</Button>
              </form>
              <div className="mt-2 text-xs text-fg/60">Restore is Admin/Owner only and runs in a DB transaction.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {canImport ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload / Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-fg/70">
              Upload a filled template. Rows update existing projects when ProjectId matches; otherwise projects are matched by LLC + AddressLine1 + Zip.
            </p>
            <ImportForm />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Upload / Import</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-fg/70">Only Admin/Owner can import the master spreadsheet.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Required columns</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-fg/70">
          <div>ProjectName, AddressLine1, City, State, Zip, LLCName</div>
          <div className="mt-2 text-xs">
            Optional: ProjectId, UnitCount, Status, CityNumber, LLCLegalName, EIN, PATaxNumber, QBConnectionId, QBConnectionDisplayName.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
