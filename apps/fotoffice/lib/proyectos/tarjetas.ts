import "server-only";
import { prisma } from "@repo/db";
import { fechaValida } from "./fechas";
import { estadoDe, type EstadoDeProyecto } from "./ficha-vista";
import { puedeVerProyectos, type CtxProyectos } from "./acceso";
import { suspendidosEntre } from "./proyectos";

/** Lo que muestra la tarjeta "Proyectos" de la ficha del pedido, de la consulta y del contacto. */
export type ProyectoDeTarjeta = {
  id: string;
  numero: string;
  nombre: string;
  flujo: string;
  etapa: string | null;
  /** "YYYY-MM-DD". */
  finalDueDate: string | null;
  estado: EstadoDeProyecto;
};

export type DondeProyectos = { pedidoId: string } | { clientId: string } | { consultaLeadId: string };

const TOPE_TARJETA = 200;

/** Puro: el `where` de Prisma de cada forma de pedir proyectos. Siempre lleva el `workspaceId`. */
export function filtroDeTarjeta(workspaceId: string, donde: DondeProyectos) {
  if ("pedidoId" in donde) return { workspaceId, pedidoId: donde.pedidoId };
  if ("clientId" in donde) return { workspaceId, clientId: donde.clientId };
  // Los proyectos de una consulta son los de los pedidos que salieron de ella (pedido del mismo workspace).
  return { workspaceId, pedido: { is: { consultaLeadId: donde.consultaLeadId, workspaceId } } };
}

/**
 * Los proyectos de un pedido, de un contacto o de una consulta (por los pedidos que salieron de
 * ella), del workspace de la sesión. Sin "Ver" en Proyectos, nada. Los más nuevos primero.
 */
export async function proyectosParaTarjeta(ctx: CtxProyectos, donde: DondeProyectos): Promise<ProyectoDeTarjeta[]> {
  if (!puedeVerProyectos(ctx)) return [];
  const { workspaceId } = ctx;
  const filas = await prisma.fotofficeProyecto.findMany({
    where: filtroDeTarjeta(workspaceId, donde),
    orderBy: [{ createdAt: "desc" }, { number: "desc" }],
    select: { id: true, number: true, name: true, circuitId: true, finalDueDate: true },
    take: TOPE_TARJETA,
  });
  if (filas.length === 0) return [];
  const ids = filas.map((f) => f.id);
  const [circuitos, recorridos, suspendidos] = await Promise.all([
    prisma.fotofficeCircuit.findMany({
      where: { workspaceId, id: { in: [...new Set(filas.map((f) => f.circuitId))] } },
      select: { id: true, name: true },
    }),
    prisma.fotofficeJourney.findMany({
      where: { workspaceId, subjectType: "PROYECTO", subjectId: { in: ids }, closedAt: null },
      select: { subjectId: true, stageId: true },
    }),
    suspendidosEntre(workspaceId, ids),
  ]);
  const etapaIds = [...new Set(recorridos.map((r) => r.stageId).filter((x): x is string => x !== null))];
  const etapas = etapaIds.length
    ? await prisma.fotofficeStage.findMany({ where: { id: { in: etapaIds }, circuit: { workspaceId } }, select: { id: true, name: true } })
    : [];
  const flujo = new Map(circuitos.map((c) => [c.id as string, c.name as string]));
  const etapa = new Map(etapas.map((e) => [e.id as string, e.name as string]));
  const abierto = new Map(recorridos.map((r) => [r.subjectId as string, r.stageId as string | null]));
  return filas.map((f) => ({
    id: f.id,
    numero: f.number,
    nombre: f.name,
    flujo: flujo.get(f.circuitId) ?? "Flujo",
    etapa: abierto.has(f.id) ? ((abierto.get(f.id) ? etapa.get(abierto.get(f.id)!) : null) ?? null) : null,
    finalDueDate: fechaValida(f.finalDueDate),
    estado: estadoDe(suspendidos.has(f.id), !abierto.has(f.id)),
  }));
}
