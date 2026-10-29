import { NextResponse } from "next/server";
import { aprobar, comentar } from "@/lib/fotolibro/revision-cliente";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Lo que hace el cliente desde el enlace, sin cuenta: comentar un pliego o aprobar el libro. El
 * enlace es la llave (largo y al azar); si el estudio lo corta, deja de funcionar.
 */
export async function POST(request: Request, context: Ctx) {
  const { token } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { accion?: string; pliego?: number; texto?: string; nombre?: string };
  const nombre = typeof body.nombre === "string" ? body.nombre : "";
  const r =
    body.accion === "aprobar"
      ? await aprobar(token, nombre)
      : await comentar(token, { pliego: Number(body.pliego ?? 0), texto: typeof body.texto === "string" ? body.texto : "", nombre });
  if (!r) return NextResponse.json({ error: "Este enlace ya no está disponible o el libro ya fue aprobado." }, { status: 404 });
  return NextResponse.json({ estado: r.estado, comentarios: r.comentarios, aprobacion: r.aprobacion });
}
