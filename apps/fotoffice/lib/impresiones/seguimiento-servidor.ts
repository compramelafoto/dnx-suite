import "server-only";
import { prisma } from "@repo/db";
import { faseDeEtapa, type Fase } from "@/lib/proyectos/en-curso-puro";

/**
 * La fase de cada trabajo (por id de proyecto), calculada igual que "Trabajos en curso": `faseDeEtapa` sobre la
 * etapa actual de su recorrido; recorrido cerrado = Entregado. Sólo lee; no toca nada.
 */
export async function fasesDeTrabajos(workspaceId: string, proyectoIds: string[]): Promise<Fase[]> {
  if (proyectoIds.length === 0) return [];
  const journeys = await prisma.fotofficeJourney.findMany({
    where: { workspaceId, subjectType: "PROYECTO", subjectId: { in: proyectoIds }, kind: "TRABAJO" },
    select: { circuitId: true, stageId: true },
  });
  if (journeys.length === 0) return [];
  const etapas = await prisma.fotofficeStage.findMany({
    where: { circuitId: { in: [...new Set(journeys.map((j) => j.circuitId))] }, archivedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, circuitId: true, name: true, color: true, order: true },
  });
  return journeys.map((j) => {
    if (j.stageId === null) return "ENTREGADO";
    const lista = etapas.filter((e) => e.circuitId === j.circuitId);
    const actual = lista.find((e) => e.id === j.stageId);
    if (!actual) return "EN_PROCESO";
    return faseDeEtapa({ name: actual.name, color: actual.color, order: actual.order, esUltima: lista.at(-1)?.id === actual.id });
  });
}
