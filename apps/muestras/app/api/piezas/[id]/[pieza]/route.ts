import { NextResponse } from "next/server";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { frenarPorUsuario } from "@/lib/limite";
import { armarPieza } from "@/lib/piezas/armar";
import { cargarMuestraParaPiezas } from "@/lib/piezas/cargar";
import { entregarPdf } from "@/lib/piezas/entregar";
import { PIEZAS_CON_QR, opcionesDePieza } from "@/lib/piezas/opciones";
import { getUsuario } from "@/lib/usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 40 fotos pasadas a JPEG tardan: más margen que el de una ruta común.
export const maxDuration = 60;

/** Piezas para imprimir de una muestra (marcos, cartel, catálogo, plano, afiche del libro). Dueño o super admin. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; pieza: string }> }) {
  const usuario = await getUsuario();
  // Igual que las fichas: sin sesión, a ingresar; no se usa el id para nada.
  if (!usuario) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/panel/montaje")}`, req.url), 307);
  const { id, pieza } = await params;
  const opciones = opcionesDePieza(pieza, new URL(req.url).searchParams);
  if (!opciones) return NextResponse.json({ error: "Esa pieza no existe." }, { status: 404 });
  if (!frenarPorUsuario("piezas", usuario.id).allowed) {
    return NextResponse.json({ error: "Pediste muchos PDF seguidos. Esperá unos minutos." }, { status: 429 });
  }
  const a = await cargarMuestraParaPiezas(id, usuario, { publicada: PIEZAS_CON_QR.includes(opciones.pieza) });
  if (!a) return NextResponse.json({ error: "No encontramos esa muestra entre las tuyas. Las piezas con QR piden la muestra publicada." }, { status: 404 });
  try {
    const r = await armarPieza(a, opciones, baseUrlPublica());
    if (!r) return NextResponse.json({ error: "Esa obra no es de esta muestra." }, { status: 404 });
    return await entregarPdf(r.bytes, { nombre: r.nombre, activityId: a.id });
  } catch (err) {
    console.error("GET /api/piezas:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "No pudimos armar el PDF. Probá de nuevo." }, { status: 500 });
  }
}
