import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { orgId: user.orgId, userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-fg/70">In-app alerts for updates, draws, and exceptions.</p>
        </div>
        <form action={markAllNotificationsRead}>
          <Button variant="secondary" type="submit">Mark all read</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {notifications.length === 0 ? (
            <p className="text-sm text-fg/70">No notifications.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {notifications.map((n) => (
                <div key={n.id} className="px-3 py-3 odd:bg-muted/60 even:bg-card">
                  <div className="flex items-center justify-between">
                    <div className={n.readAt ? "font-medium" : "font-semibold"}>{n.title}</div>
                    <div className="text-xs text-fg/60">{n.createdAt.toLocaleString()}</div>
                  </div>
                  <div className="text-sm text-fg/70">{n.body}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
