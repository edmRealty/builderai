import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function TaxAbatementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tax Abatement</h1>
        <p className="text-sm text-fg/70">Coming soon: abatement status, compliance, and expiration alerts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planned</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-fg/70 space-y-2">
          <div>- Track abatement program + term end date</div>
          <div>- Store required filings and inspection docs</div>
          <div>- Alert 30/60/90 days before expiration</div>
        </CardContent>
      </Card>
    </div>
  );
}

