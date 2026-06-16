import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function PropertyValueTrackerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Property Value Tracker</h1>
        <p className="text-sm text-fg/70">Coming soon: ARV changes, rent comps, and market trend notes.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planned</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-fg/70 space-y-2">
          <div>- Track value assumptions per project</div>
          <div>- Add checkpoints (pre-demo, rough-in, CO)</div>
          <div>- Capture notes and supporting docs</div>
        </CardContent>
      </Card>
    </div>
  );
}

