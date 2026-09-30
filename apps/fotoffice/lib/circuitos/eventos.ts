import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { EVENTOS, ESTADOS_CAPTACION, SALIDAS, type Evento } from "./constantes";
import { esRetroceso } from "./calculos";
import {
  cerrarEnTransaccion,
  esRechazo,
  iniciarEnTransaccion,
  iniciarRecorrido,
  moverEnTransaccion,
  OPCIONES_TRANSACCION,
} from "./recorridos";
import { asegurarCircuitos } from "./semillas/asegurar";
import { adaptadorDe, type Sujeto } from "./sujetos";
import { contextoDeSistema, type CtxCircuitos } from "./acceso";

/** Tamaño de cada lote al leer las consultas existentes. */
export const LOTE_ENGANCHE = 200;
/** Consultas que se enganchan como mucho en cada llamada (cada una es una transacción). */
export const TOPE_ENGANCHE = 150;
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

  // El registro del evento y el movimiento van juntos: si el movimiento se frena o falla, el
  // evento no queda marcado y un nuevo aviso puede moverlo.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.fotofficeProcessedEvent.create({ data: { journeyId: j.id, event: evento, sourceRef } });
      await moverEnTransaccion(tx, ctx, j.id, destino.id, { auto: { evento }, esperado: j.enteredStageAt });
    }, OPCIONES_TRANSACCION);
  } catch (error) {
    // Ya procesado, o el motor lo rechazó (tareas obligatorias, cambió mientras tanto).
    if (esChoqueDeUnicidad(error) || esRechazo(error)) return false;
    throw error;
  }
  return true;
}

type EstadoConsulta = (typeof ESTADOS_CAPTACION)[number] | "WON" | "LOST";

/**
 * Engancha una vez las consultas del workspace que todavía no tienen recorrido de venta:
 * NEW → primera etapa del circuito predeterminado; CONTACTED / QUOTED / INTERESTED → la etapa
 * marcada con ese estado (o la primera); WON / LOST → recorrido cerrado como Ganada / Perdida
 * (motivo "Otro") con la nota "Importada con su estado anterior".
 *
 * Cada consulta se engancha en UNA transacción que primero toma un bloqueo por consulta y vuelve
 * a mirar si ya tiene recorrido de venta (abierto o cerrado): dos corridas simultáneas no la
 * duplican, y una falla no la deja a medias (se reintenta en la próxima llamada). Engancha como
 * mucho `TOPE_ENGANCHE` por llamada; `quedan` son las que siguen sin recorrido al terminar.
 */
export async function engancharConsultas(workspaceId: string): Promise<{ enganchadas: number; quedan: number }> {
  const circuito = await circuitoDeVenta(workspaceId);
  if (!circuito) return { enganchadas: 0, quedan: await sinRecorrido(workspaceId) };
  const etapas = await prisma.fotofficeStage.findMany({
    where: { circuitId: circuito.id, circuit: { workspaceId }, archivedAt: null },
    select: { id: true, leadStatus: true },
    orderBy: { order: "asc" },
  });
  const primera = etapas[0];
  if (!primera) return { enganchadas: 0, quedan: await sinRecorrido(workspaceId) };
  const etapaPorEstado = new Map<string, string>();
  for (const e of etapas) if (e.leadStatus && !etapaPorEstado.has(e.leadStatus)) etapaPorEstado.set(e.leadStatus, e.id);
  const motivoId = await motivoDeImportacion(workspaceId);

  // La importación refleja el estado que la consulta ya tenía: no la frenan tareas
  // obligatorias de etapas por las que nunca pasó (el paso queda marcado como forzado).
  const ctx: CtxCircuitos = { ...contextoDeSistema(workspaceId), role: "WORKSPACE_OWNER" };
  const plan = { circuitoId: circuito.id, primeraId: primera.id, etapaPorEstado, motivoId };

  let enganchadas = 0;
  let intentadas = 0;
  let quedan = 0;
  await recorrerSinRecorrido(workspaceId, async (lead) => {
    const estado = lead.status as EstadoConsulta;
    if (intentadas >= TOPE_ENGANCHE || (estado === "LOST" && !motivoId)) {
      quedan++; // sin motivo activo no se puede perder: espera
      return;
    }
    intentadas++;
    try {
      if (await engancharUna(ctx, lead.id, estado, plan)) enganchadas++;
    } catch (error) {
      quedan++;
      registrarFalla("engancharConsultas", { workspaceId, estado }, error);
    }
  });
  return { enganchadas, quedan };
}

/** Recorre, en lotes, las consultas del workspace sin ningún recorrido de venta. */
async function recorrerSinRecorrido(workspaceId: string, cadaUna: (lead: { id: string; status: string }) => Promise<void>): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const lote = await prisma.serviceSalesLead.findMany({
      where: { workspaceId, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, status: true },
      orderBy: { id: "asc" },
      take: LOTE_ENGANCHE,
    });
    if (lote.length === 0) return;
    cursor = lote[lote.length - 1]!.id;
    const conRecorrido = new Set(
      (
        await prisma.fotofficeJourney.findMany({
          where: { workspaceId, subjectType: "CAPTACION", kind: "VENTA", subjectId: { in: lote.map((l) => l.id) } },
          select: { subjectId: true },
        })
      ).map((j) => j.subjectId),
    );
    for (const lead of lote) if (!conRecorrido.has(lead.id)) await cadaUna(lead);
    if (lote.length < LOTE_ENGANCHE) return;
  }
}

async function sinRecorrido(workspaceId: string): Promise<number> {
  let n = 0;
  await recorrerSinRecorrido(workspaceId, async () => {
    n++;
  });
  return n;
}

/**
 * Engancha una consulta en una sola transacción. Devuelve false si otra corrida ya la enganchó.
 * El bloqueo es por consulta y dura hasta el fin de la transacción.
 */
async function engancharUna(
  ctx: CtxCircuitos,
  leadId: string,
  estado: EstadoConsulta,
  plan: { circuitoId: string; primeraId: string; etapaPorEstado: Map<string, string>; motivoId: string | null },
): Promise<boolean> {
  const { workspaceId } = ctx;
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-enganche:${leadId}`}))`;
    const ya = await tx.fotofficeJourney.count({ where: { workspaceId, subjectType: "CAPTACION", subjectId: leadId, kind: "VENTA" } });
    if (ya > 0) return false;

    const { journeyId } = await iniciarEnTransaccion(tx, ctx, { tipo: "CAPTACION", id: leadId }, plan.circuitoId);
    const destino = plan.etapaPorEstado.get(estado);
    if (estado !== "NEW" && destino && destino !== plan.primeraId) {
      await moverEnTransaccion(tx, ctx, journeyId, destino, { nota: NOTA_IMPORTADA, forzar: true });
    }
    if (estado === "WON" || estado === "LOST") {
      const exito = estado === "WON";
      const salida = exito ? SALIDAS.VENTA.exito : SALIDAS.VENTA.fracaso;
      await cerrarEnTransaccion(tx, ctx, journeyId, salida, exito ? undefined : plan.motivoId!, NOTA_IMPORTADA, { forzar: true });
    }
    return true;
  }, OPCIONES_TRANSACCION);
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
