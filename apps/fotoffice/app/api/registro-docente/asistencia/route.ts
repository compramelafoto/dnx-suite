import { NextResponse } from "next/server";
import { contextoRegistro } from "@/lib/registro-docente/contexto";
import { guardarAsistencia, type RegistroAsistencia } from "@/lib/registro-docente/servidor";

export const dynamic = "force-dynamic";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Una planilla de asistencia (un curso, un día) que manda el celular, al momento o cuando vuelve la
 * señal. Es una ruta y no una acción de servidor a propósito: una planilla guardada sin señal puede
 * mandarse después de un despliegue, y el identificador de una acción cambia en cada despliegue.
 * Reenviarla no duplica nada.
 */
export async function POST(req: Request) {
  const c = await contextoRegistro("MANAGE");
  if (!c) return NextResponse.json({ error: "Tu sesión no tiene permiso para tomar lista. Volvé a entrar." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    cursoId?: unknown;
    fecha?: unknown;
    sinClase?: unknown;
    motivo?: unknown;
    horaDocente?: unknown;
    registros?: unknown;
  } | null;
  if (!body || typeof body.cursoId !== "string" || typeof body.fecha !== "string" || !FECHA.test(body.fecha) || !Array.isArray(body.registros)) {
    return NextResponse.json({ error: "La planilla llegó incompleta." }, { status: 400 });
  }
  if (body.registros.length > 300) return NextResponse.json({ error: "Demasiados registros." }, { status: 400 });
  const registros = body.registros.filter(
    (r): r is RegistroAsistencia =>
      typeof r === "object" && r !== null && typeof (r as RegistroAsistencia).estudianteId === "string" && typeof (r as RegistroAsistencia).anotadaAt === "string",
  ).map((r) => ({ ...r, horaLlegada: typeof r.horaLlegada === "string" ? r.horaLlegada : null }));
  try {
    const r = await guardarAsistencia(c.workspaceId, {
      cursoId: body.cursoId,
      fecha: body.fecha,
      sinClase: body.sinClase === true,
      motivo: typeof body.motivo === "string" ? body.motivo.slice(0, 120) || null : null,
      horaDocente: typeof body.horaDocente === "string" ? body.horaDocente : null,
      registros,
    });
    return NextResponse.json({ ok: true, ...r }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_EXISTE") return NextResponse.json({ error: "Ese curso ya no existe." }, { status: 404 });
    throw e;
  }
}
