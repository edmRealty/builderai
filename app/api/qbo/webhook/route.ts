import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  // MVP: store raw webhook payload for later processing.
  // Later: verify Intuit signature, map to qbConnection by realmId, and enqueue processing.
  const realmId = body?.eventNotifications?.[0]?.realmId ?? null;

  const qbConnection = realmId
    ? await prisma.quickBooksConnection.findFirst({ where: { qboRealmId: String(realmId) } })
    : null;

  if (!qbConnection) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  await prisma.integrationEvent.create({
    data: {
      orgId: qbConnection.orgId,
      qbConnectionId: qbConnection.id,
      source: "QBO_WEBHOOK",
      payload: body ?? {}
    }
  });

  return NextResponse.json({ ok: true });
}
