import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { isIntlPilotUser } from "@/lib/international/pilot";
import { walletView } from "@/lib/international/topup-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saldo en dólares del fotógrafo del piloto internacional. 404 para el resto. */
export async function GET() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  if (!isIntlPilotUser(user.id)) return NextResponse.json({ error: "No disponible." }, { status: 404 });
  try {
    return NextResponse.json(await walletView(user.id));
  } catch {
    console.error("[saldo-internacional] GET falló");
    return NextResponse.json({ error: "No pudimos cargar tu saldo. Probá de nuevo." }, { status: 500 });
  }
}
