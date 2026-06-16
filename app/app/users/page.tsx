import Link from "next/link";

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { createUser } from "@/lib/actions/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function UsersPage() {
  const user = await requireUser();

  const users = await prisma.user.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" }
  });

  const canManage = user.role === "ADMIN" || user.role === "OWNER";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-fg/70">Create users and assign roles. (Assignments to projects/loans next.)</p>
        </div>
        {canManage ? (
          <details className="relative">
            <summary className="list-none marker:hidden">
              <Button type="button">Add user</Button>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-[min(760px,calc(100vw-2rem))] rounded-md border border-border bg-card p-3 shadow">
              <form action={createUser} className="grid gap-3 md:grid-cols-3">
                <Input name="email" type="email" placeholder="user@company.com" required />
                <select name="role" className="h-10 rounded-md border border-border bg-bg px-3 text-sm" required>
                  <option value="PROJECT_MANAGER">Project Manager</option>
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="FIELD_AGENT">Field Agent</option>
                  <option value="BANKER">Banker</option>
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <Input name="password" type="password" placeholder="Temporary password" required />
                <div className="md:col-span-3 flex items-center justify-end">
                  <Button type="submit">Create user</Button>
                </div>
              </form>
            </div>
          </details>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="divide-y divide-border rounded-md border border-border">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-3 odd:bg-muted/60 even:bg-card">
                <div>
                  <div className="font-medium">
                    <Link className="underline" href={`/app/users/${u.id}`}>{u.email}</Link>
                  </div>
                  <div className="text-sm text-fg/70">{u.role.replaceAll("_", " ")}</div>
                </div>
                <div className="text-sm text-fg/70">{u.mfaEnabled ? "MFA on" : "MFA off"}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
