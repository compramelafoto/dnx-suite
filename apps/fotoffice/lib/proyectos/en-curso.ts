import "server-only";
import { prisma } from "@repo/db";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import type { CtxProyectos } from "./acceso";
import { faseDeEtapa, type EtapaVista, type Fase } from "./en-curso-puro";

/**
 * Los datos de "Trabajos en curso": cada trabajo con su recorrido abierto (o cerrado en los
 * últimos 7 días, para la columna Entregado), con todo lo que la tarjeta muestra sin abrir la
 * ficha: cliente, etapa, recorrido, proveedor, entrega prometida y saldo del pedido.
 */

export type TarjetaTrabajo = {
  proyectoId: string;
  journeyId: string;
  numero: string;
  nombre: string;
  cliente: string;
  telefono: string | null;
  email: string | null;
  producto: string | null;
  recorrido: { id: string; nombre: string };
  etapas: EtapaVista[];
  /** null si el recorrido ya se cerró. */
  etapaActualId: string | null;
  fase: Fase;
  /** Cuándo entró a la etapa: el tablero lo manda al mover (control de cambios simultáneos). */
  enteredStageAt: string;
  entrega: string | null;
  proveedor: string | null;
  enviadoAt: string | null;
  pedido: { id: string; numero: string; saldoMinor: number } | null;
  cerrado: boolean;
};

const DIAS_ENTREGADOS = 7;

function ymd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function cargarTrabajosEnCurso(ctx: CtxProyectos, ahora: Date): Promise<TarjetaTrabajo[]> {
  const desde = new Date(ahora.getTime() - DIAS_ENTREGADOS * 86_400_000);
  const journeys = await prisma.fotofficeJourney.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      subjectType: "PROYECTO",
      OR: [{ stageId: { not: null } }, { outcome: "TERMINADO", closedAt: { gte: desde } }],
    },
    select: { id: true, subjectId: true, circuitId: true, stageId: true, enteredStageAt: true, closedAt: true },
    take: 600,
  });
  if (journeys.length === 0) return [];

  const proyectoIds = journeys.map((j) => j.subjectId);
  const circuitIds = [...new Set(journeys.map((j) => j.circuitId))];
  const [proyectos, circuitos, etapas] = await Promise.all([
    prisma.fotofficeProyecto.findMany({
      where: { workspaceId: ctx.workspaceId, id: { in: proyectoIds }, suspendedAt: null },
      select: {
        id: true,
        number: true,
        name: true,
        entregaPrometida: true,
        finalDueDate: true,
        proveedorEnviadoAt: true,
        pedidoId: true,
        client: { select: { firstName: true, lastName: true, businessName: true, phone: true, email: true } },
        product: { select: { name: true } },
        proveedor: { select: { name: true } },
      },
    }),
    prisma.fotofficeCircuit.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: circuitIds } }, select: { id: true, name: true } }),
    prisma.fotofficeStage.findMany({
      where: { circuitId: { in: circuitIds }, archivedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, circuitId: true, name: true, color: true, order: true },
    }),
  ]);

  // Saldo de cada pedido: total menos los cobros vigentes.
  const pedidoIds = [...new Set(proyectos.map((p) => p.pedidoId).filter((x): x is string => x !== null))];
  const [pedidos, cobros] = pedidoIds.length
    ? await Promise.all([
        prisma.fotofficePedido.findMany({
          where: { workspaceId: ctx.workspaceId, id: { in: pedidoIds } },
          select: { id: true, number: true, totalArs: true, status: true },
        }),
        prisma.fotofficeCobro.groupBy({
          by: ["pedidoId"],
          where: { workspaceId: ctx.workspaceId, pedidoId: { in: pedidoIds }, voidedAt: null },
          _sum: { amountArs: true },
        }),
      ])
    : [[], []];
  const cobradoDe = new Map(cobros.map((c) => [c.pedidoId, Number(c._sum.amountArs ?? 0)]));
  const pedidoDe = new Map(
    pedidos.map((p) => [
      p.id,
      {
        id: p.id,
        numero: p.number,
        saldoMinor: p.status === "CANCELADO" ? 0 : Math.max(0, Math.round((Number(p.totalArs) - (cobradoDe.get(p.id) ?? 0)) * 100)),
      },
    ]),
  );

  const proyectoDe = new Map(proyectos.map((p) => [p.id, p]));
  const circuitoDe = new Map(circuitos.map((c) => [c.id, c.name]));
  const etapasDe = new Map<string, EtapaVista[]>();
  for (const e of etapas) {
    const lista = etapasDe.get(e.circuitId) ?? [];
    lista.push({ id: e.id, name: e.name, color: e.color, order: e.order });
    etapasDe.set(e.circuitId, lista);
  }

  const out: TarjetaTrabajo[] = [];
  for (const j of journeys) {
    const p = proyectoDe.get(j.subjectId);
    if (!p) continue;
    const lista = etapasDe.get(j.circuitId) ?? [];
    const actual = lista.find((e) => e.id === j.stageId) ?? null;
    const cerrado = j.stageId === null;
    const fase: Fase = cerrado
      ? "ENTREGADO"
      : actual
        ? faseDeEtapa({ name: actual.name, color: actual.color, order: actual.order, esUltima: lista.at(-1)?.id === actual.id })
        : "EN_PROCESO";
    out.push({
      proyectoId: p.id,
      journeyId: j.id,
      numero: p.number,
      nombre: p.name,
      cliente: nombreDeContacto(p.client),
      telefono: p.client?.phone ?? null,
      email: p.client?.email ?? null,
      producto: p.product?.name ?? null,
      recorrido: { id: j.circuitId, nombre: circuitoDe.get(j.circuitId) ?? "Recorrido" },
      etapas: lista,
      etapaActualId: j.stageId,
      fase,
      enteredStageAt: j.enteredStageAt.toISOString(),
      entrega: ymd(p.entregaPrometida) ?? ymd(p.finalDueDate),
      proveedor: p.proveedor?.name ?? null,
      enviadoAt: p.proveedorEnviadoAt ? p.proveedorEnviadoAt.toISOString() : null,
      pedido: p.pedidoId ? (pedidoDe.get(p.pedidoId) ?? null) : null,
      cerrado,
    });
  }
  return out;
}
