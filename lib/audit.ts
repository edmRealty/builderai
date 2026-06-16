import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

type AuditArgs = {
  orgId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  data?: unknown;
};

export async function auditEvent({ orgId, userId, action, entityType, entityId, data }: AuditArgs) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;

  await prisma.auditEvent.create({
    data: {
      orgId,
      userId: userId ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      data: (data ?? {}) as any,
      ip,
      userAgent
    }
  });
}
