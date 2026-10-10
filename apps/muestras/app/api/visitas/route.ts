import { prisma } from "@repo/db";
import { ACTIVITY_LEVEL } from "@repo/muestras";
import { esDeQuienOrganiza, pedidoContable, sumarUno } from "@/lib/estadisticas/contar";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Baliza de visita (D14). Responde siempre 204 sin cuerpo: no dice nada de lo que existe ni de
 * si se contó.
 */
export async function POST(req: Request) {
  const listo = () => new Response(null, { status: 204 });
  if (!pedidoContable(req.headers)) return listo();
  if (Number(req.headers.get("content-length") ?? 0) > 1000) return listo();
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse((await req.text()).slice(0, 1000));
  } catch {
    return listo();
  }
  const { a, o } = (cuerpo && typeof cuerpo === "object" ? cuerpo : {}) as { a?: unknown; o?: unknown };
  if (typeof a !== "string" || !ID.test(a) || (o !== undefined && (typeof o !== "string" || !ID.test(o)))) return listo();
  if (!frenarPorIp("visitas", ipDeLaPeticion(req.headers)).allowed) return listo();
  try {
    const actividad = await prisma.culturalActivity.findFirst({ where: { id: a, reviewStatus: "APPROVED" }, select: { id: true, proposedByUserId: true } });
    if (!actividad) return listo();
    if (o) {
      const obra = await prisma.culturalActivityWork.findFirst({ where: { id: o, activityId: a }, select: { id: true } });
      if (!obra) return listo();
    }
    if (await esDeQuienOrganiza(actividad.proposedByUserId)) return listo();
    await sumarUno({ activityId: a, workId: o ?? ACTIVITY_LEVEL, metric: "VIEW" });
  } catch (err) {
    console.error("[visitas] no se pudo contar:", err instanceof Error ? err.message : String(err));
  }
  return listo();
}
