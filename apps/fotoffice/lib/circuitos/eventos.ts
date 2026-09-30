import "server-only";
import { prisma } from "@repo/db";
import { EVENTOS, ESTADOS_CAPTACION, SALIDAS, type Evento } from "./constantes";
import { esRetroceso } from "./calculos";
import { cerrar, iniciarRecorrido, mover } from "./recorridos";
import { asegurarCircuitos } from "./semillas/asegurar";
import { adaptadorDe, type Sujeto } from "./sujetos";
import { contextoDeSistema, type CtxCircuitos } from "./acceso";

/** Tamaño de cada lote al enganchar las consultas existentes. */
export const LOTE_ENGANCHE = 200;
export const NOTA_IMPORTADA = "Importada con su estado anterior";
const MOTIVO_IMPORTADA = "Otro";

function esChoqueDeUnicidad(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

/** Sólo el tipo y el código del error: nunca su mensaje (puede traer datos de la consulta). */
function registrarFalla(donde: string, datos: Record<string, string>, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[circuitos] ${donde} falló`, { ...datos, error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

/** Si el workspace todavía no tiene ningún circuito, carga los iniciales (DNX o el mínimo). */
async function asegurarAlgunCircuito(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficeCircuit.count({ where: { workspaceId } })) > 0) return;
  const branding = await prisma.fotofficeWorkspaceBranding.findFirst({ where: { workspaceId }, select: { publicSlug: true } });
  await asegurarCircuitos(workspaceId, branding?.publicSlug ?? "");
}

/**
 * Un módulo avisa que pasó `evento` sobre un registro. Nunca lanza: una falla del motor no
 * puede romper la operación del módulo que avisa.
 *
 * - `CONSULTA_RECIBIDA`: pone el registro en la primera etapa del circuito predeterminado
 *   (cargando los circuitos iniciales si el workspace no tiene ninguno).
 * - Los demás: en cada recorrido abierto del registro, busca una regla de ese evento en su
 *   circuito y lo mueve a esa etapa como "Sistema". Nunca retrocede ni se queda en el lugar, y el
 *   mismo evento con el mismo `sourceRef` no mueve dos veces (`FotofficeProcessedEvent`).
 */
export async function notificarEvento(workspaceId: string, sujeto: Sujeto, evento: Evento, sourceRef: string): Promise<{ movido: boolean }> {
  try {
    if (!(EVENTOS as readonly string[]).includes(evento) || !adaptadorDe(sujeto.tipo)) return { movido: false };
    const ctx = contextoDeSistema(workspaceId);

    if (evento === "CONSULTA_RECIBIDA") {
      await asegurarAlgunCircuito(workspaceId);
      await iniciarRecorrido(ctx, sujeto);
      return { movido: true };
    }

    const abiertos = await prisma.fotofficeJourney.findMany({
      where: { workspaceId, subjectType: sujeto.tipo, subjectId: sujeto.id, closedAt: null },
      select: { id: true, circuitId: true, stageId: true, enteredStageAt: true },
      orderBy: { createdAt: "asc" },
    });
    let movido = false;
    for (const j of abiertos) {
      if (j.stageId === null) continue;
      if (await aplicarRegla(ctx, { ...j, stageId: j.stageId }, evento, sourceRef)) movido = true;
    }
    return { movido };
  } catch (error) {
    registrarFalla("notificarEvento", { workspaceId, evento, tipo: sujeto.tipo }, error);
    return { movido: false };
  }
}

async function aplicarRegla(
  ctx: CtxCircuitos,
  j: { id: string; circuitId: string; stageId: string; enteredStageAt: Date },
  evento: Evento,
  sourceRef: string,
): Promise<boolean> {
  const etapas = await prisma.fotofficeStage.findMany({
    where: { circuitId: j.circuitId, circuit: { workspaceId: ctx.workspaceId } },
    select: { id: true, order: true, days: true, archivedAt: true },
  });
  const activas = etapas.filter((e) => e.archivedAt === null);
  if (activas.length === 0) return false;
  const reglas = await prisma.fotofficeStageRule.findMany({
    where: { event: evento, stageId: { in: activas.map((e) => e.id) } },
    select: { stageId: true },
  });
  // Si varias etapas escuchan el mismo evento, gana la más avanzada.
  const destino = activas
    .filter((e) => reglas.some((r) => r.stageId === e.id))
    .sort((a, b) => b.order - a.order)[0];
  if (!destino || esRetroceso(etapas, j.stageId, destino.id)) return false;

  try {
    await prisma.fotofficeProcessedEvent.create({ data: { journeyId: j.id, event: evento, sourceRef } });
  } catch (error) {
    if (esChoqueDeUnicidad(error)) return false; // ya procesado
    throw error;
  }
  const r = await mover(ctx, j.id, destino.id, { auto: { evento }, esperado: j.enteredStageAt });
  if (!r.ok) {
    // No se movió (tareas obligatorias pendientes, cambió mientras tanto): el evento queda
    // disponible para un nuevo aviso.
    await prisma.fotofficeProcessedEvent.deleteMany({ where: { journeyId: j.id, event: evento, sourceRef } });
    return false;
  }
  return true;
}

type EstadoConsulta = (typeof ESTADOS_CAPTACION)[number] | "WON" | "LOST";

/**
 * Engancha una vez las consultas del workspace que todavía no tienen recorrido de venta:
 * NEW → primera etapa del circuito predeterminado; CONTACTED / QUOTED / INTERESTED → la etapa
 * marcada con ese estado (o la primera); WON / LOST → recorrido cerrado como Ganada / Perdida
 * (motivo "Otro") con la nota "Importada con su estado anterior". Idempotente: sólo mira
 * consultas sin ningún recorrido de venta. Una consulta que falla no frena a las demás.
 */
export async function engancharConsultas(workspaceId: string): Promise<{ enganchadas: number }> {
  const circuito = await circuitoDeVenta(workspaceId);
  if (!circuito) return { enganchadas: 0 };
  const etapas = await prisma.fotofficeStage.findMany({
    where: { circuitId: circuito.id, circuit: { workspaceId }, archivedAt: null },
    select: { id: true, leadStatus: true },
    orderBy: { order: "asc" },
  });
  const primera = etapas[0];
  if (!primera) return { enganchadas: 0 };
  const etapaPorEstado = new Map<string, string>();
  for (const e of etapas) if (e.leadStatus && !etapaPorEstado.has(e.leadStatus)) etapaPorEstado.set(e.leadStatus, e.id);
  const motivoId = await motivoDeImportacion(workspaceId);

  // La importación refleja el estado que la consulta ya tenía: no la frenan tareas
  // obligatorias de etapas por las que nunca pasó (el paso queda marcado como forzado).
  const ctx: CtxCircuitos = { ...contextoDeSistema(workspaceId), role: "WORKSPACE_OWNER" };
  const salidas = SALIDAS.VENTA;
  let enganchadas = 0;
  let cursor: string | undefined;
  for (;;) {
    const lote = await prisma.serviceSalesLead.findMany({
      where: { workspaceId, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, status: true },
      orderBy: { id: "asc" },
      take: LOTE_ENGANCHE,
    });
    if (lote.length === 0) break;
    cursor = lote[lote.length - 1]!.id;

    const conRecorrido = new Set(
      (
        await prisma.fotofficeJourney.findMany({
          where: { workspaceId, subjectType: "CAPTACION", kind: "VENTA", subjectId: { in: lote.map((l) => l.id) } },
          select: { subjectId: true },
        })
      ).map((j) => j.subjectId),
    );
    for (const lead of lote) {
      if (conRecorrido.has(lead.id)) continue;
      const estado = lead.status as EstadoConsulta;
      if (estado === "LOST" && !motivoId) continue; // sin motivo activo no se puede perder
      try {
        const { journeyId } = await iniciarRecorrido(ctx, { tipo: "CAPTACION", id: lead.id }, circuito.id);
        const destino = etapaPorEstado.get(estado);
        if (estado !== "NEW" && destino && destino !== primera.id) {
          const r = await mover(ctx, journeyId, destino, { nota: NOTA_IMPORTADA, forzar: true });
          if (!r.ok) throw new Error(r.error);
        }
        if (estado === "WON" || estado === "LOST") {
          const exito = estado === "WON";
          const r = await cerrar(ctx, journeyId, exito ? salidas.exito : salidas.fracaso, exito ? undefined : motivoId!, NOTA_IMPORTADA, {
            forzar: true,
          });
          if (!r.ok) throw new Error(r.error);
        }
        enganchadas++;
      } catch (error) {
        registrarFalla("engancharConsultas", { workspaceId, estado }, error);
      }
    }
    if (lote.length < LOTE_ENGANCHE) break;
  }
  return { enganchadas };
}

async function circuitoDeVenta(workspaceId: string) {
  const pred = await prisma.fotofficeCircuit.findFirst({
    where: { workspaceId, kind: "VENTA", isActive: true, isDefault: true },
    select: { id: true },
  });
  if (pred) return pred;
  return prisma.fotofficeCircuit.findFirst({
    where: { workspaceId, kind: "VENTA", isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
}

/** "Otro" si está activo; si no, el primer motivo activo del workspace. */
async function motivoDeImportacion(workspaceId: string): Promise<string | null> {
  const otro = await prisma.fotofficeLossReason.findFirst({
    where: { workspaceId, name: MOTIVO_IMPORTADA, isActive: true },
    select: { id: true },
  });
  if (otro) return otro.id;
  const primero = await prisma.fotofficeLossReason.findFirst({
    where: { workspaceId, isActive: true },
    select: { id: true },
    orderBy: { order: "asc" },
  });
  return primero?.id ?? null;
}
