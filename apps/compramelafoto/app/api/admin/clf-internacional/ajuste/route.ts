import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { isIntlPilotUser } from "@/lib/international/pilot";
import { recordAdjustment } from "@/lib/international/wallet-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ajuste manual del saldo internacional (devoluciones del piloto y correcciones). */
export async function POST(req: Request) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { userId?: unknown; amountUsdCents?: unknown; note?: unknown };
  const userId = Number(body.userId);
  const amountUsdCents = Number(body.amountUsdCents);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!Number.isInteger(userId) || !isIntlPilotUser(userId)) {
    return NextResponse.json({ error: "Ese usuario no está en el piloto." }, { status: 400 });
  }
  if (!Number.isInteger(amountUsdCents) || amountUsdCents === 0 || Math.abs(amountUsdCents) > 100000) {
    return NextResponse.json({ error: "El monto no es válido." }, { status: 400 });
  }
  if (note.length < 3) return NextResponse.json({ error: "Escribí el motivo del ajuste." }, { status: 400 });
  await recordAdjustment({ userId, amountUsdCents, note, createdByUserId: user.id });
  return NextResponse.json({ ok: true });
}
