import Image from "next/image";

import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { getMfaSetupQr } from "../../../../lib/actions/auth";
import { MfaSetupForm } from "./mfa-setup-form";

export default async function MfaSetupPage() {
  const { qrDataUrl } = await getMfaSetupQr();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Set up MFA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-fg/70">
            Scan this QR code with Google Authenticator / Authy, then enter the 6-digit code.
          </p>
          <div className="flex justify-center">
            <Image src={qrDataUrl} alt="MFA QR" width={220} height={220} />
          </div>
          <MfaSetupForm />
        </CardContent>
      </Card>
    </div>
  );
}
