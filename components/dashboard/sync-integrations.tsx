"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type IntegrationKey = "qb" | "buildium";

const storageKey = (key: IntegrationKey) => `mfcms:syncBanner:dontAskAgain:${key}`;

function readFlag(key: IntegrationKey) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(key)) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: IntegrationKey, value: boolean) {
  try {
    window.localStorage.setItem(storageKey(key), value ? "1" : "0");
  } catch {
    // ignore
  }
}

function IntegrationTile(props: {
  integration: IntegrationKey;
  title: string;
  description: string;
  hint: string;
}) {
  const [dontAskAgain, setDontAskAgain] = React.useState(false);

  React.useEffect(() => {
    setDontAskAgain(readFlag(props.integration));
  }, [props.integration]);

  if (dontAskAgain) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{props.title}</div>
          <div className="mt-1 text-sm text-fg/70">{props.description}</div>
          <div className="mt-2 text-xs text-fg/60">{props.hint}</div>
        </div>
        <Button
          onClick={() => window.alert("Sync is a placeholder right now. Connect the integration first; wiring sync is next.")}
        >
          Sync now
        </Button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-fg/70">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          checked={dontAskAgain}
          onChange={(e) => {
            const checked = e.target.checked;
            setDontAskAgain(checked);
            writeFlag(props.integration, checked);
          }}
        />
        Don’t ask again (auto-sync nightly at 12:00 AM ET)
      </label>
    </div>
  );
}

export function SyncIntegrationsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <IntegrationTile
            integration="qb"
            title="Sync with QuickBooks"
            description="Bring in unmatched transactions and keep commitments aligned."
            hint="Connect a QB connection in Corp → LLC → QuickBooks connections."
          />
          <IntegrationTile
            integration="buildium"
            title="Sync with Buildium"
            description="Keep rental units + occupancy in sync for rent-ready projects."
            hint="Buildium sync is planned; unit IDs are already tracked on Units."
          />
        </div>
        <div className="text-xs text-fg/60">
          Nightly sync scheduling will run server-side; this banner only controls whether you see these prompts.
        </div>
      </CardContent>
    </Card>
  );
}

