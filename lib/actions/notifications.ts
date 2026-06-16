"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { orgId: user.orgId, userId: user.id, readAt: null },
    data: { readAt: new Date() }
  });
}
