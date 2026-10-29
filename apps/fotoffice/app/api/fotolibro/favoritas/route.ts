import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { guardarFavoritas, leerFavoritas } from "@/lib/fotolibro/favoritas";
import { FAVORITAS_MAX, leerFavorita } from "@/lib/fotolibro/favoritas-tipos";

export const runtime = "nodejs";

/** Las distribuciones favoritas de quien está usando el diseñador de fotolibros. */
export async function GET() {
  const user = await requireAuth();
  return NextResponse.json({ favoritas: await leerFavoritas(user.id) });
}

/** Guarda una distribución nueva: `{ nombre, marcos }` con los marcos en proporción del pliego. */
export async function POST(request: Request) {
  const user = await requireAuth();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nueva = leerFavorita({ ...body, id: randomUUID().slice(0, 12) });
  if (!nueva) return NextResponse.json({ error: "Esa distribución no es válida." }, { status: 400 });
  const actuales = await leerFavoritas(user.id);
  if (actuales.length >= FAVORITAS_MAX) {
    return NextResponse.json({ error: `Llegaste a ${FAVORITAS_MAX} favoritas: borrá alguna para guardar otra.` }, { status: 400 });
  }
  const favoritas = [nueva, ...actuales];
  await guardarFavoritas(user.id, favoritas);
  return NextResponse.json({ favoritas });
}

export async function DELETE(request: Request) {
  const user = await requireAuth();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const favoritas = (await leerFavoritas(user.id)).filter((f) => f.id !== id);
  await guardarFavoritas(user.id, favoritas);
  return NextResponse.json({ favoritas });
}
