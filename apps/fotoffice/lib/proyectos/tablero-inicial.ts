import "server-only";
import { prisma } from "@repo/db";

/**
 * El flujo con que abre el tablero de Proyectos cuando la dirección no pide uno: el primero (por
 * nombre) de los flujos de trabajo activos que tiene proyectos en curso. Sin ninguno, null: el
 * tablero usa el flujo predeterminado o el primero. Siempre dentro del workspace.
 */
export async function circuitoInicialDelTablero(workspaceId: string): Promise<string | null> {
  const [circuitos, abiertos] = await Promise.all([
    prisma.fotofficeCircuit.findMany({
      where: { workspaceId, kind: "TRABAJO", isActive: true },
      select: { id: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.fotofficeJourney.groupBy({
      by: ["circuitId"],
      where: { workspaceId, subjectType: "PROYECTO", closedAt: null },
      _count: true,
    }),
  ]);
  const conProyectos = new Set(abiertos.map((a) => a.circuitId as string));
  return circuitos.find((c) => conProyectos.has(c.id as string))?.id ?? null;
}
