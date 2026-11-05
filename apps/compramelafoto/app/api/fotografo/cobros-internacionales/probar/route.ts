import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { recheckCollectionAccount } from "@/lib/international/collection-account-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vuelve a comprobar la cuenta conectada contra Mercado Pago o PayPal. */
export async function POST() {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
    }
    const result = await recheckCollectionAccount(user.id);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ account: result.account });
  } catch {
    console.error("[cobros-internacionales/probar] POST falló");
    return NextResponse.json({ error: "No pudimos comprobar la cuenta. Probá de nuevo." }, { status: 500 });
  }
}
