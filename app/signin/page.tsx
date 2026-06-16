import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/app/(public)/login/login-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const orgCount = await prisma.organization.count();
  const showDemoOneClick = process.env.DEMO_LOGIN_ENABLED === "true";

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm showDemoOneClick={showDemoOneClick} />
          {orgCount === 0 ? (
            <p className="text-sm text-fg/70">
              No organization yet. <Link className="underline" href="/setup">Run setup</Link>.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
