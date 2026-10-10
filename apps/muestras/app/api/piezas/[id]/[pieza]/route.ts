import { NextResponse } from "next/server";
import { FRAME_BATCH_SIZE } from "@repo/muestras";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { frenarPorUsuario } from "@/lib/limite";
import { armarPieza } from "@/lib/piezas/armar";
import { cargarMuestraParaPiezas } from "@/lib/piezas/cargar";
import { entregarPdf, errorEnTexto } from "@/lib/piezas/entregar";
import { PIEZAS_CON_QR, opcionesDePieza } from "@/lib/piezas/opciones";
import { getUsuario } from "@/lib/usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Las fotos pasadas a JPEG tardan (una por vez): un catálogo de 300 obras (el tope técnico) lleva
// cerca de 2 minutos. 300 s requiere el plan Pro de Vercel (o "fluid compute"); spec D18.
export const maxDuration = 300;

/** Piezas para imprimir de una muestra (marcos, cartel, catálogo, plano, afiche del libro). Dueño o super admin. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; pieza: string }> }) {
  const usuario = await getUsuario();
  // Igual que las fichas: sin sesión, a ingresar; no se usa el id para nada.
  if (!usuario) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/panel/montaje")}`, req.url), 307);
  const { id, pieza } = await params;
  const opciones = opcionesDePieza(pieza, new URL(req.url).searchParams);
  if (!opciones) return errorEnTexto("Esa pieza no existe.", 404);
  // El marco de una sola obra es liviano y se pide uno por obra: lleva su propio tope.
  const freno = opciones.pieza === "marcos" && opciones.obra ? "piezaObra" : "piezas";
  if (!frenarPorUsuario(freno, usuario.id).allowed) {
    return errorEnTexto("Pediste muchos PDF seguidos. Esperá unos minutos.", 429);
  }
  const a = await cargarMuestraParaPiezas(id, usuario, { publicada: PIEZAS_CON_QR.includes(opciones.pieza) });
  if (!a) return errorEnTexto("No encontramos esa muestra entre las tuyas. Las piezas con QR piden la muestra publicada.", 404);
  if (opciones.pieza === "marcos" && opciones.tanda && (opciones.tanda - 1) * FRAME_BATCH_SIZE >= a.works.length) {
    return errorEnTexto("Esa tanda no existe.", 404);
  }
  // Marcos con foto de todas las obras: de a tandas (el panel nunca lo ofrece de otra forma).
  if (opciones.pieza === "marcos" && opciones.conFoto && !opciones.obra && !opciones.tanda && a.works.length > FRAME_BATCH_SIZE) {
    return errorEnTexto(`Con más de ${FRAME_BATCH_SIZE} obras, bajá los marcos por tandas.`, 404);
  }
  try {
    const r = await armarPieza(a, opciones, baseUrlPublica());
    if (!r) return errorEnTexto("Esa obra no es de esta muestra.", 404);
    return await entregarPdf(r.bytes, { nombre: r.nombre, activityId: a.id });
  } catch (err) {
    console.error("GET /api/piezas:", err instanceof Error ? err.message : String(err));
    return errorEnTexto("No pudimos armar el PDF. Probá de nuevo.", 500);
  }
}
