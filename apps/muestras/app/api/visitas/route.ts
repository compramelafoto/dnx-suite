import { prisma } from "@repo/db";
import { ACTIVITY_LEVEL } from "@repo/muestras";
import { esDelEquipo } from "@/lib/equipo/permisos";
import { pedidoContable, sumarUno } from "@/lib/estadisticas/contar";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_BYTES = 1000;

/** Lee el cuerpo hasta `max` bytes aunque no venga `content-length`; `null` si se pasa. */
async function leerHasta(req: Request, max: number): Promise<string | null> {
  if (!req.body) return "";
  const lector = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lector.cancel().catch(() => {});
      return null;
    }
    partes.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(partes));
}

/**
 * Baliza de visita (D14). Responde siempre 204 sin cuerpo: no dice nada de lo que existe ni de
 * si se contó.
 */
export async function POST(req: Request) {
  const listo = () => new Response(null, { status: 204 });
  if (!pedidoContable(req.headers)) return listo();
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return listo();
  let cuerpo: unknown;
  try {
    const texto = await leerHasta(req, MAX_BYTES);
    if (texto === null) return listo();
    cuerpo = JSON.parse(texto);
  } catch {
    return listo();
  }
  const { a, o } = (cuerpo && typeof cuerpo === "object" ? cuerpo : {}) as { a?: unknown; o?: unknown };
  if (typeof a !== "string" || !ID.test(a) || (o !== undefined && (typeof o !== "string" || !ID.test(o)))) return listo();
  const ip = ipDeLaPeticion(req.headers);
  if (!frenarPorIp("visitas", ip).allowed) return listo();
  try {
    const actividad = await prisma.culturalActivity.findFirst({ where: { id: a, reviewStatus: "APPROVED" }, select: { id: true } });
    if (!actividad) return listo();
    if (o) {
      const obra = await prisma.culturalActivityWork.findFirst({ where: { id: o, activityId: a }, select: { id: true } });
      if (!obra) return listo();
    }
    // Con la muestra y la obra ya validadas: el ámbito no puede ser un valor inventado.
    if (!frenarPorIp("visitasPorPagina", ip, `${actividad.id}:${o ?? ACTIVITY_LEVEL}`).allowed) return listo();
    // El equipo de la muestra (y el super admin) no cuenta (D10).
    if (await esDelEquipo(actividad.id)) return listo();
    await sumarUno({ activityId: a, workId: o ?? ACTIVITY_LEVEL, metric: "VIEW" });
  } catch (err) {
    console.error("[visitas] no se pudo contar:", err instanceof Error ? err.message : String(err));
  }
  return listo();
}
