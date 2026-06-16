import Link from "next/link";

import { requireUser } from "@/lib/require-user";
import { onboardingCreateVendor } from "@/lib/actions/vendor-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function NewVendorPage() {
  const user = await requireUser();
  const canCreate = ["ADMIN", "OWNER", "PROJECT_MANAGER", "ACCOUNTANT"].includes(user.role);

  if (!canCreate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Add Vendor</h1>
          <Link className="underline" href="/app/vendors">Back</Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Not allowed</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-fg/70">Your role can’t create vendors.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Add Vendor (Onboarding)</h1>
          <p className="text-sm text-fg/70">Step 1 of 3: basic info. Progress saves on each step.</p>
        </div>
        <Link className="underline" href="/app/vendors">Back to vendors</Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic info</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onboardingCreateVendor} className="grid gap-3 md:grid-cols-2">
            <Input name="name" placeholder="Vendor name" required />
            <Input name="contactName" placeholder="Contact person (optional)" />
            <Input name="email" type="email" placeholder="Email (optional)" />
            <Input name="phone" placeholder="Phone (optional)" />
            <Input name="expertise" placeholder="Expertise (optional): plumbing, electric, drywall..." />
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Save & continue</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
