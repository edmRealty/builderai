import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { MfaVerifyForm } from "./mfa-verify-form";

export default async function MfaVerifyPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Verify MFA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-fg/70">
            Enter the 6-digit code from your authenticator app (Google Authenticator / Authy). No email is sent.
          </p>
          <p className="text-sm text-fg/70">
            If you haven’t scanned the QR yet, go to{" "}
            <Link className="underline" href="/mfa/setup">
              MFA Setup
            </Link>
            .
          </p>
          <MfaVerifyForm />
        </CardContent>
      </Card>
    </div>
  );
}
