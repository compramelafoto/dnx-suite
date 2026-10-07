import "server-only";
import { prisma } from "@repo/db";
import { numeroDe } from "@/lib/numeracion/asignar";
import { puedeVerPresupuestos, type CtxPresupuestos } from "./acceso";
import { ENTIDAD_NUMERACION } from "./constantes";

/**
 * Entradas de presupuestos para el historial de la consulta (spec etapa 2 §2 A.11): cada envío de
 * una versión, la primera vez que el cliente la abrió (con cuántas veces en total) y la
 * aceptación. Con "Ver" en Presupuestos; si no, nada. Sin costos, sin IP y sin navegador.
 */
export type EventoDePresupuesto = {
  id: string;
  fecha: Date;
  texto: string;
  href: string;
};

const TOPE_VISTAS = 2000;

export async function eventosDePresupuestos(ctx: CtxPresupuestos, leadId: string): Promise<EventoDePresupuesto[]> {
  if (!puedeVerPresupuestos(ctx)) return [];
  const { workspaceId } = ctx;
  const presupuestos = await prisma.fotofficePresupuesto.findMany({
    where: { workspaceId, consultaLeadId: leadId },
    select: { id: true },
  });
  if (presupuestos.length === 0) return [];
  const ids = presupuestos.map((p) => p.id);
  const [versiones, numeros] = await Promise.all([
    prisma.fotofficePresupuestoVersion.findMany({
      where: { workspaceId, presupuestoId: { in: ids }, sentAt: { not: null } },
      select: { id: true, presupuestoId: true, number: true, sentAt: true, acceptedAt: true, acceptedName: true },
    }),
    numeroDe(workspaceId, ENTIDAD_NUMERACION, ids),
  ]);
  const vistas = versiones.length
    ? await prisma.fotofficePresupuestoVista.findMany({
        where: { workspaceId, versionId: { in: versiones.map((v) => v.id) } },
        orderBy: [{ viewedAt: "asc" }],
        take: TOPE_VISTAS,
        select: { versionId: true, viewedAt: true },
      })
    : [];
  const porVersion = new Map<string, { primera: Date; cantidad: number }>();
  for (const v of vistas) {
    const x = porVersion.get(v.versionId);
    if (x) x.cantidad += 1;
    else porVersion.set(v.versionId, { primera: v.viewedAt, cantidad: 1 });
  }

  const out: EventoDePresupuesto[] = [];
  for (const v of versiones) {
    const numero = numeros.get(v.presupuestoId);
    const cual = `${numero ? `N° ${numero}` : "sin número"} (V${v.number})`;
    const href = `/presupuestos/${encodeURIComponent(v.presupuestoId)}`;
    if (v.sentAt) out.push({ id: `envio-${v.id}`, fecha: v.sentAt, texto: `Se envió el presupuesto ${cual}`, href });
    const vista = porVersion.get(v.id);
    if (vista) {
      const veces = vista.cantidad > 1 ? ` (lo abrió ${vista.cantidad} veces)` : "";
      out.push({ id: `vista-${v.id}`, fecha: vista.primera, texto: `El cliente abrió el presupuesto ${cual}${veces}`, href });
    }
    if (v.acceptedAt) {
      const quien = v.acceptedName ? ` (${v.acceptedName})` : "";
      out.push({ id: `aceptado-${v.id}`, fecha: v.acceptedAt, texto: `El cliente aceptó el presupuesto ${cual}${quien}`, href });
    }
  }
  return out.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
}
