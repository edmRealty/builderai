import { prisma } from "@/lib/prisma";
import { setupFirstAdmin } from "@/lib/actions/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const orgCount = await prisma.organization.count();
  const disabled = orgCount > 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Initial Setup</CardTitle>
        </CardHeader>
        <CardContent>
          {disabled ? (
            <p className="text-sm text-fg/70">Setup already completed.</p>
          ) : (
            <form action={setupFirstAdmin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Organization name</label>
                <Input name="orgName" placeholder="Acme Development" required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Admin email</label>
                <Input name="adminEmail" type="email" placeholder="admin@company.com" required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Admin password</label>
                <Input name="adminPassword" type="password" placeholder="8+ characters" required />
              </div>
              <Button type="submit" className="w-full">Create admin</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
