import { prisma } from "@/lib/prisma";
import { sha256Hex } from "@/lib/crypto";
import { formatMoney } from "@/lib/format";
import { submitVendorInvoice } from "@/lib/actions/vendor-portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function VendorUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = sha256Hex(token);

  const req = await prisma.vendorInvoiceRequest.findUnique({
    where: { tokenHash },
    include: { commitment: { include: { vendor: true, project: true } } }
  });

  if (!req) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Link not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-fg/70">This invoice upload link is invalid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expired = req.expiresAt.getTime() < Date.now();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Upload invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted p-3 text-sm">
            <div className="font-medium">{req.commitment.project.name}</div>
            <div className="text-fg/70">{req.commitment.vendor.name}</div>
            <div className="text-fg/70">Job: {req.commitment.scope}</div>
            <div className="text-fg/70">Agreed: {formatMoney(req.commitment.agreedCents)}</div>
          </div>

          {expired ? (
            <p className="text-sm text-danger">This link has expired. Please request a new link.</p>
          ) : req.status !== "OPEN" ? (
            <p className="text-sm text-fg/70">This invoice request has already been submitted.</p>
          ) : (
            <form action={submitVendorInvoice} className="space-y-3">
              <input type="hidden" name="token" value={token} />
              <div className="space-y-1">
                <label className="text-sm font-medium">Invoice amount</label>
                <Input name="amount" placeholder="e.g., 25000" required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input name="notes" placeholder="Anything we should know" />
              </div>
              <Button type="submit" className="w-full">Submit</Button>
              <p className="text-xs text-fg/60">
                File uploads (PDF/images, W-9/COI/lien waiver) are enabled next; this MVP captures invoice metadata.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
