import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { decryptString } from "@/lib/crypto";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const qbConnectionId = body?.qbConnectionId as string | undefined;
  const agentKey = body?.agentKey as string | undefined;

  if (!qbConnectionId || !agentKey) {
    return NextResponse.json({ ok: false, error: "Missing qbConnectionId/agentKey" }, { status: 400 });
  }

  const conn = await prisma.quickBooksConnection.findUnique({ where: { id: qbConnectionId } });
  if (!conn || conn.type !== "QBD" || !conn.qbdAgentKeyEnc) {
    return NextResponse.json({ ok: false, error: "Unknown connection" }, { status: 404 });
  }

  let expected: string;
  try {
    expected = decryptString(conn.qbdAgentKeyEnc);
  } catch {
    return NextResponse.json({ ok: false, error: "Agent key decrypt failed" }, { status: 500 });
  }

  if (agentKey !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const instructions = await prisma.qbdInstruction.findMany({
    where: { qbConnectionId: conn.id, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 50
  });

  if (instructions.length > 0) {
    await prisma.qbdInstruction.updateMany({
      where: { id: { in: instructions.map((i) => i.id) } },
      data: { status: "ACKED" }
    });
  }

  return NextResponse.json({ ok: true, instructions });
}
