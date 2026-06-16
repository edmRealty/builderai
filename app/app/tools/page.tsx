import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const tools = [
  {
    href: "/app/tools/property-tax",
    title: "Property Tax",
    description: "Track taxes, due dates, and escrow vs owed."
  },
  {
    href: "/app/tools/property-value-tracker",
    title: "Property Value Tracker",
    description: "Monitor ARV and market movement over time."
  },
  {
    href: "/app/tools/tax-abatement",
    title: "Tax Abatement",
    description: "Track abatements, expirations, and compliance documents."
  }
];

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tools</h1>
        <p className="text-sm text-fg/70">Shortcuts for property ops + compliance workflows.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {tools.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="hover:bg-muted/40">
              <CardHeader>
                <CardTitle>{t.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-fg/70">{t.description}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

