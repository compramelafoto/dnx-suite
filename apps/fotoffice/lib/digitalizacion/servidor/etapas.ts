import "server-only";
import { prisma } from "@repo/db";
import type { CtxCircuitos } from "@/lib/circuitos/acceso";
import { mover } from "@/lib/circuitos/recorridos";
import { decidirAvance, decidirConciliacion, type DecisionAvance, type EtapaParaAvance, type ObjetivoEtapa } from "../etapas-automaticas";

/**
 * Avance automático de etapas de los trabajos de digitalización (criterio en
 * `../etapas-automaticas.ts`). Mueve con `mover` del motor de recorridos, como un cambio a mano:
 * deja el paso en el historial (actor «Sistema», nota «Entró en … (automático: …)»), recalcula el
 * vencimiento de la etapa y crea sus tareas.
 *
 * Nada de acá lanza: quien lo llama ya guardó lo suyo (la grabación, el envío) y un problema con
 * la etapa sólo deja un log. Los logs llevan ids, nunca datos personales.
 */

export type ResultadoEtapa = "MOVIDO" | "SIN_CAMBIO" | "FALLO";

type Recorrido = { id: string; circuitId: string; stageId: string | null; enteredStageAt: Date };

function codigo(e: unknown): string {
  const c = e as { code?: unknown; name?: unknown } | null;
  return typeof c?.code === "string" ? c.code : typeof c?.name === "string" ? c.name : "desconocido";
}

/** El contexto de sistema del motor (como `contextoDeSistema`, sin traer la sesión de `acceso.ts`). */
function ctxSistema(workspaceId: string): CtxCircuitos {
  return { workspaceId, userId: null, userLabel: "Sistema", role: null };
}

async function etapasDe(circuitIds: string[]): Promise<Map<string, (EtapaParaAvance & { circuitId: string })[]>> {
  const etapas = circuitIds.length
    ? await prisma.fotofficeStage.findMany({
        where: { circuitId: { in: circuitIds } },
        orderBy: { order: "asc" },
        select: { id: true, name: true, order: true, archivedAt: true, circuitId: true },
      })
    : [];
  const porCircuito = new Map<string, (EtapaParaAvance & { circuitId: string })[]>();
  for (const e of etapas) porCircuito.set(e.circuitId, [...(porCircuito.get(e.circuitId) ?? []), e]);
  return porCircuito;
}

async function aplicar(
  workspaceId: string,
  proyectoId: string,
  j: Recorrido,
  decision: DecisionAvance,
  origen: string,
): Promise<ResultadoEtapa> {
  if (decision.tipo === "NADA") {
    // La conciliación corre cada 15 minutos: no repite este aviso en cada vuelta.
    if (origen !== "CONCILIACION" && (decision.motivo === "SIN_ETAPA" || decision.motivo === "ETAPA_ACTUAL_DESCONOCIDA")) {
      console.info("[digitalizacion][etapas] el trabajo no avanza", { origen, workspaceId, proyectoId, motivo: decision.motivo });
    }
    return "SIN_CAMBIO";
  }
  const r = await mover(ctxSistema(workspaceId), j.id, decision.etapa.id, { nota: decision.nota, esperado: j.enteredStageAt });
  if (!r.ok) {
    console.warn("[digitalizacion][etapas] el motor no dejó avanzar el trabajo", { origen, workspaceId, proyectoId, etapaId: decision.etapa.id });
    return "FALLO";
  }
  return "MOVIDO";
}

/** Avanza cada trabajo al objetivo, sólo hacia adelante. Nunca lanza. */
export async function avanzarTrabajos(workspaceId: string, proyectoIds: readonly string[], objetivo: ObjetivoEtapa): Promise<Record<ResultadoEtapa, number>> {
  const cuenta: Record<ResultadoEtapa, number> = { MOVIDO: 0, SIN_CAMBIO: 0, FALLO: 0 };
  const ids = [...new Set(proyectoIds)];
  if (ids.length === 0) return cuenta;
  try {
    const [proyectos, recorridos] = await Promise.all([
      prisma.fotofficeProyecto.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true, suspendedAt: true } }),
      prisma.fotofficeJourney.findMany({
        where: { workspaceId, subjectType: "PROYECTO", subjectId: { in: ids }, closedAt: null, stageId: { not: null } },
        select: { id: true, circuitId: true, stageId: true, enteredStageAt: true, subjectId: true },
      }),
    ]);
    const etapas = await etapasDe([...new Set(recorridos.map((j) => j.circuitId))]);
    for (const p of proyectos) {
      try {
        const j = recorridos.find((r) => r.subjectId === p.id);
        if (!j) { cuenta.SIN_CAMBIO++; continue; } // terminado, cancelado o sin recorrido
        const decision = decidirAvance(etapas.get(j.circuitId) ?? [], { etapaActualId: j.stageId, suspendido: p.suspendedAt !== null }, objetivo);
        cuenta[await aplicar(workspaceId, p.id, j, decision, objetivo)]++;
      } catch (e) {
        cuenta.FALLO++;
        console.error("[digitalizacion][etapas] falló el avance de un trabajo", { origen: objetivo, workspaceId, proyectoId: p.id, codigo: codigo(e) });
      }
    }
  } catch (e) {
    cuenta.FALLO++;
    console.error("[digitalizacion][etapas] falló el avance de trabajos", { origen: objetivo, workspaceId, codigo: codigo(e) });
  }
  return cuenta;
}

export const TOPE_CONCILIACION = 500;

/**
 * Conciliación del cron (trabajos viejos y avances que fallaron): los trabajos de pedidos con una
 * grabación terminada con imagen, o con la entrega ya enviada, se llevan a su etapa con la misma
 * regla, sólo hacia adelante. Idempotente: un trabajo que ya llegó no se mueve. Sólo recorridos
 * abiertos y trabajos sin suspender; de los más nuevos a los más viejos. Nunca lanza.
 */
export async function conciliarEtapas(
  estaEncendido: (workspaceId: string) => Promise<boolean>,
  opciones: { tope?: number } = {},
): Promise<{ revisados: number; movidos: number; fallidos: number }> {
  const reporte = { revisados: 0, movidos: 0, fallidos: 0 };
  try {
    const proyectos = await prisma.fotofficeProyecto.findMany({
      where: {
        pedidoId: { not: null },
        suspendedAt: null,
        grabaciones: { some: { estado: "COMPLETA" } },
        OR: [
          { grabaciones: { some: { estado: "COMPLETA", sinImagen: false } } },
          { pedido: { digitalizacionEntrega: { is: { enviadoAt: { not: null } } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: opciones.tope ?? TOPE_CONCILIACION,
      select: {
        id: true,
        workspaceId: true,
        pedido: { select: { digitalizacionEntrega: { select: { enviadoAt: true } } } },
        grabaciones: { where: { estado: "COMPLETA", sinImagen: false }, select: { id: true }, take: 1 },
      },
    });
    if (proyectos.length === 0) return reporte;
    const recorridos = await prisma.fotofficeJourney.findMany({
      where: { subjectType: "PROYECTO", subjectId: { in: proyectos.map((p) => p.id) }, closedAt: null, stageId: { not: null } },
      select: { id: true, workspaceId: true, circuitId: true, stageId: true, enteredStageAt: true, subjectId: true },
    });
    const etapas = await etapasDe([...new Set(recorridos.map((j) => j.circuitId))]);
    for (const p of proyectos) {
      const j = recorridos.find((r) => r.subjectId === p.id && r.workspaceId === p.workspaceId);
      if (!j) continue;
      try {
        if (!(await estaEncendido(p.workspaceId))) continue;
        reporte.revisados++;
        const decision = decidirConciliacion(
          etapas.get(j.circuitId) ?? [],
          { etapaActualId: j.stageId, suspendido: false },
          { grabacionTerminadaConImagen: p.grabaciones.length > 0, entregaEnviada: !!p.pedido?.digitalizacionEntrega?.enviadoAt },
        );
        if (!decision) continue;
        const r = await aplicar(p.workspaceId, p.id, j, decision, "CONCILIACION");
        if (r === "MOVIDO") reporte.movidos++;
        if (r === "FALLO") reporte.fallidos++;
      } catch (e) {
        reporte.fallidos++;
        console.error("[digitalizacion][etapas] falló la conciliación de un trabajo", { workspaceId: p.workspaceId, proyectoId: p.id, codigo: codigo(e) });
      }
    }
  } catch (e) {
    reporte.fallidos++;
    console.error("[digitalizacion][etapas] falló la conciliación de etapas", { codigo: codigo(e) });
  }
  return reporte;
}
