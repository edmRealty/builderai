import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { decryptString } from "@/lib/crypto";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const qbConnectionId = body?.qbConnectionId as string | undefined;
  const agentKey = body?.agentKey as string | undefined;
  const instructionId = body?.instructionId as string | undefined;
  const ok = body?.ok as boolean | undefined;
  const error = body?.error as string | undefined;

  if (!qbConnectionId || !agentKey || !instructionId || typeof ok !== "boolean") {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const conn = await prisma.quickBooksConnection.findUnique({ where: { id: qbConnectionId } });
  if (!conn || conn.type !== "QBD" || !conn.qbdAgentKeyEnc) {
    return NextResponse.json({ ok: false, error: "Unknown connection" }, { status: 404 });
  }

  const expected = decryptString(conn.qbdAgentKeyEnc);
  if (agentKey !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await prisma.qbdInstruction.update({
    where: { id: instructionId },
    data: {
      status: ok ? "DONE" : "ERROR",
      error: ok ? null : error ?? "Unknown error"
    }
  });

  return NextResponse.json({ ok: true });
}
