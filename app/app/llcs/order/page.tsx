import Link from "next/link";

import { requireUser } from "@/lib/require-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OrderLlcPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Order New LLC</h1>
          <p className="text-sm text-fg/70">Placeholder page for LLC ordering workflow.</p>
        </div>
        <Link className="underline" href="/app/llcs">Back to corp</Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next step</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-fg/70">
          This will become a guided workflow (state filing, EIN request, bank setup, and QuickBooks connection). For now,
          create the LLC manually and then click “Add an LLC” on the corp page.
        </CardContent>
      </Card>
    </div>
  );
}

