import "server-only";
import { prisma } from "@repo/db";
import { mover } from "@/lib/circuitos/recorridos";
import type { CtxProyectos } from "./acceso";
import { faseDeEtapa, type Fase, FASES } from "./en-curso-puro";

/**
 * Avances automáticos de un trabajo: lo lleva a la primera etapa de su recorrido que cae en la
 * fase pedida ("En el proveedor" al mandarle el pedido al laboratorio, "Listo para retirar" cuando
 * llega). Nunca retrocede: si ya está en esa fase o más adelante, no hace nada.
 */
export type ResultadoAvance = { ok: true; movido: boolean; etapa: string | null } | { ok: false; error: string };

export async function moverAFase(ctx: CtxProyectos, proyectoId: string, fase: Fase, nota: string): Promise<ResultadoAvance> {
  const j = await prisma.fotofficeJourney.findFirst({
    where: { workspaceId: ctx.workspaceId, subjectType: "PROYECTO", subjectId: proyectoId, stageId: { not: null } },
    select: { id: true, circuitId: true, stageId: true },
  });
  if (!j?.stageId) return { ok: true, movido: false, etapa: null };
  const etapas = await prisma.fotofficeStage.findMany({
    where: { circuitId: j.circuitId, archivedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true, order: true },
  });
  const conFase = etapas.map((e, i) => ({ ...e, fase: faseDeEtapa({ ...e, esUltima: i === etapas.length - 1 }) }));
  const actual = conFase.find((e) => e.id === j.stageId);
  if (!actual) return { ok: true, movido: false, etapa: null };
  if (FASES.indexOf(actual.fase) >= FASES.indexOf(fase)) return { ok: true, movido: false, etapa: actual.name };
  const destino = conFase.find((e) => e.order > actual.order && e.fase === fase);
  if (!destino) return { ok: true, movido: false, etapa: actual.name };
  const r = await mover(ctx, j.id, destino.id, { nota });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, movido: true, etapa: destino.name };
}
