import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VendorThanksPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Thank you</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-fg/70">Your invoice was submitted successfully.</p>
          <p className="mt-3 text-sm"><Link className="underline" href="/">Back</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
