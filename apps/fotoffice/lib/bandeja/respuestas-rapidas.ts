import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { puedeVerBandeja, type CtxBandeja } from "./acceso";
import { validarRespuesta, type RespuestaRapida } from "./respuestas-rapidas-puro";

/**
 * Respuestas rápidas del workspace (servidor). Las lee quien ve la Bandeja; las cambia el dueño o
 * un administrador (`configurar`). Todo con el `workspaceId` del contexto.
 */

type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
const SIN_PERMISO = "Sólo el dueño o un administrador pueden cambiar las respuestas rápidas.";
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function listarRespuestas(ctx: CtxBandeja): Promise<RespuestaRapida[] | null> {
  if (!puedeVerBandeja(ctx) && !puede(ctx.acceso, "configurar")) return null;
  try {
    return (await prisma.fotofficeWaRespuestaRapida.findMany({
      where: { workspaceId: ctx.workspaceId, activa: true },
      orderBy: [{ orden: "asc" }, { atajo: "asc" }],
      select: { id: true, atajo: true, titulo: true, texto: true },
    })) as RespuestaRapida[];
  } catch {
    // Tabla sin migrar: la caja de respuesta sigue funcionando sin la lista.
    return [];
  }
}

export async function guardarRespuesta(ctx: CtxBandeja, datos: { id?: unknown; atajo?: unknown; titulo?: unknown; texto?: unknown }): Promise<Resultado<{ id: string }>> {
  if (!puede(ctx.acceso, "configurar")) return { ok: false, error: SIN_PERMISO };
  const v = validarRespuesta(datos);
  if (!v.ok) return v;
  const id = typeof datos.id === "string" && ID.test(datos.id) ? datos.id : null;
  const repetida = await prisma.fotofficeWaRespuestaRapida.findFirst({ where: { workspaceId: ctx.workspaceId, atajo: v.valor.atajo }, select: { id: true } });
  if (repetida && repetida.id !== id) return { ok: false, error: `Ya hay una respuesta con el atajo /${v.valor.atajo}.` };
  try {
    if (id) {
      const r = await prisma.fotofficeWaRespuestaRapida.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: v.valor });
      if (r.count === 0) return { ok: false, error: "No encontramos esa respuesta." };
      return { ok: true, id };
    }
    const creada = await prisma.fotofficeWaRespuestaRapida.create({ data: { workspaceId: ctx.workspaceId, ...v.valor }, select: { id: true } });
    return { ok: true, id: creada.id };
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "P2002") return { ok: false, error: `Ya hay una respuesta con el atajo /${v.valor.atajo}.` };
    console.error("[fotoffice][bandeja] falló al guardar una respuesta rápida");
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }
}

export async function borrarRespuesta(ctx: CtxBandeja, id: unknown): Promise<Resultado> {
  if (!puede(ctx.acceso, "configurar")) return { ok: false, error: SIN_PERMISO };
  if (typeof id !== "string" || !ID.test(id)) return { ok: false, error: "No encontramos esa respuesta." };
  const r = await prisma.fotofficeWaRespuestaRapida.deleteMany({ where: { id, workspaceId: ctx.workspaceId } });
  return r.count === 0 ? { ok: false, error: "No encontramos esa respuesta." } : { ok: true };
}
