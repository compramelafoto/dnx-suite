import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { startTopUp } from "@/lib/international/topup-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { chosenUsdCents?: unknown };
  try {
    const r = await startTopUp(user.id, Number(body.chosenUsdCents));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ approveUrl: r.approveUrl });
  } catch (err) {
    console.error("[saldo-internacional] no se pudo iniciar la recarga", err);
    return NextResponse.json({ error: "No pudimos iniciar la recarga. Probá de nuevo." }, { status: 502 });
  }
}
