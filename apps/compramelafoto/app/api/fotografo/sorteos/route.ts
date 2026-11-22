import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { getRafflesForPhotographer } from "@/lib/raffles/consultas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Los sorteos que le importan al fotógrafo: si entra, cuántas ventas lleva y si ganó. */
export async function GET() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json({ raffles: await getRafflesForPhotographer(user.id) });
  } catch (e) {
    // Sin las tablas todavía (o cualquier falla): el panel sigue andando sin la tarjeta.
    console.error("[fotografo/sorteos]", e);
    return NextResponse.json({ raffles: [] });
  }
}
