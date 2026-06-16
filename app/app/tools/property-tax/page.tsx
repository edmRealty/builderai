import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function PropertyTaxPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Property Tax</h1>
        <p className="text-sm text-fg/70">Coming soon: due dates, escrow tracking, and alerts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planned</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-fg/70 space-y-2">
          <div>- Store parcel + jurisdiction per project</div>
          <div>- Show next bill due + amount</div>
          <div>- Add reminders and export-ready reports</div>
        </CardContent>
      </Card>
    </div>
  );
}

