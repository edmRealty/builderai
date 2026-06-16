"use client";

import * as React from "react";

import type { MasterImportResult } from "@/lib/actions/master-sheet";
import { importMasterSpreadsheet } from "@/lib/actions/master-sheet";
import { Button } from "@/components/ui/button";

export function ImportForm() {
  const [state, formAction, isPending] = React.useActionState<MasterImportResult | null, FormData>(
    async (_prev, formData) => {
      return await importMasterSpreadsheet(formData);
    },
    null
  );

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="text-sm font-medium">Upload .xlsx</label>
          <input
            name="file"
            type="file"
            accept=".xlsx"
            className="mt-1 block w-full text-sm"
            required
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Importing…" : "Import"}
        </Button>
      </form>

      {state && !state.ok ? (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-danger">
          {state.error}
        </div>
      ) : null}

      {state && state.ok ? (
        <div className="space-y-2 rounded-md border border-border bg-muted p-3 text-sm">
          <div>
            Imported. Projects: +{state.createdProjects} created, {state.updatedProjects} updated. LLCs: +{state.createdLlcs} created, {state.updatedLlcs} updated.
          </div>
          {state.errors.length > 0 ? (
            <div>
              <div className="font-medium text-danger">Row errors ({state.errors.length})</div>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {state.errors.slice(0, 20).map((e) => (
                  <li key={`${e.row}-${e.message}`}>Row {e.row}: {e.message}</li>
                ))}
              </ul>
              {state.errors.length > 20 ? (
                <div className="mt-1 text-xs text-fg/70">Showing first 20 errors.</div>
              ) : null}
            </div>
          ) : (
            <div className="text-fg/70">No row errors.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
