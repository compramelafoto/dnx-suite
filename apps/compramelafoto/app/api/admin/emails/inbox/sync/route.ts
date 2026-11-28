import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { sincronizarDesdeResend } from "@/lib/inbound-email/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Trae de Resend los correos recibidos que todavía no están en la bandeja. */
export async function POST() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const r = await sincronizarDesdeResend();
  return NextResponse.json(r, { status: r.errores.length > 0 && r.nuevos === 0 && r.revisados === 0 ? 502 : 200 });
}
