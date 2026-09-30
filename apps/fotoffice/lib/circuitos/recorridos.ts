import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { fechaBA } from "@/lib/ficha/formato";
import { SALIDAS, type Clase, type TipoSujeto } from "./constantes";
import { esRetroceso, validarMovimiento, vencimientoDeEtapa, vencimientoDeTarea } from "./calculos";
import { adaptadorDe, type Sujeto } from "./sujetos";
import type { CtxCircuitos } from "./acceso";

type Tx = Prisma.TransactionClient;
export type Resultado = { ok: true } | { ok: false; error: string };
export type ResultadoMover = { ok: true } | { ok: false; error: string; pendientes?: string[] };

/** Un movimiento escribe recorrido, paso, tareas y el estado del sujeto: el tope por defecto (5 s) es justo en Neon. */
export const OPCIONES_TRANSACCION = { timeout: 15_000 };

export const MENSAJES = {
  noEncontrado: "No encontramos ese registro.",
  otroCircuito: "Esa etapa no es de este circuito.",
  archivada: "Esa etapa está archivada.",
  mismaEtapa: "Ya está en esa etapa.",
  cambio: "Esta consulta cambió mientras tanto.",
  cerrado: "Ese registro ya está cerrado.",
  salida: "Ese resultado no corresponde a este circuito.",
  motivo: "Elegí un motivo.",
  noEsDelEquipo: "Esa persona no es del equipo.",
  sinCircuito: "No hay un circuito para empezar.",
  sinEtapas: "Ese circuito no tiene etapas activas.",
} as const;

export function mensajeTareasPendientes(pendientes: string[]): string {
  return `Faltan tareas obligatorias: ${pendientes.join(", ")}.`;
}

/** Clase de circuito en la que arranca cada tipo de registro cuando no se elige circuito. */
const CLASE_INICIAL: Partial<Record<TipoSujeto, Clase>> = { CAPTACION: "VENTA" };

/**
 * Rechazo esperado dentro de una transacción: se lanza para deshacer todo lo escrito y se
 * convierte en `{ ok: false }` afuera.
 */
class Rechazo extends Error {
  constructor(
    readonly mensaje: string,
    readonly pendientes?: string[],
  ) {
    super(mensaje);
  }
}

function esChoqueDeUnicidad(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

async function enTransaccion<T extends { ok: true }>(fn: (tx: Tx) => Promise<T>): Promise<T | { ok: false; error: string; pendientes?: string[] }> {
  try {
    return await prisma.$transaction(fn, OPCIONES_TRANSACCION);
  } catch (error) {
    if (error instanceof Rechazo) {
      return error.pendientes ? { ok: false, error: error.mensaje, pendientes: error.pendientes } : { ok: false, error: error.mensaje };
    }
    throw error;
  }
}

/** Recorrido abierto del workspace; Rechazo si no existe o ya terminó. */
async function recorridoAbierto(tx: Tx, workspaceId: string, journeyId: string) {
  const j = await tx.fotofficeJourney.findFirst({
    where: { id: journeyId, workspaceId },
    select: {
      id: true, circuitId: true, kind: true, subjectType: true, subjectId: true, stageId: true,
      enteredStageAt: true, ownerUserId: true, closedAt: true,
    },
  });
  if (!j) throw new Rechazo(MENSAJES.noEncontrado);
  if (j.closedAt !== null || j.stageId === null) throw new Rechazo(MENSAJES.cerrado);
  return { ...j, stageId: j.stageId };
}

/** Crea como tareas reales las tareas modelo de la etapa en la que se acaba de entrar. */
async function crearTareasDeEtapa(
  tx: Tx,
  ctx: CtxCircuitos,
  j: { id: string; subjectType: string; subjectId: string; ownerUserId: number | null },
  stageId: string,
  entrada: Date,
): Promise<void> {
  const modelos = await tx.fotofficeStageTaskTemplate.findMany({
    where: { stageId, stage: { circuit: { workspaceId: ctx.workspaceId } } },
    select: { title: true, days: true, required: true },
    orderBy: { order: "asc" },
  });
  if (modelos.length === 0) return;
  await tx.fotofficeTask.createMany({
    data: modelos.map((m) => ({
      workspaceId: ctx.workspaceId,
      journeyId: j.id,
      stageId,
      subjectType: j.subjectType,
      subjectId: j.subjectId,
      title: m.title,
      dueAt: vencimientoDeTarea(entrada, m.days),
      required: m.required,
      assigneeUserId: j.ownerUserId,
      createdByUserId: ctx.userId,
    })),
  });
}

/**
 * Pone un registro en la primera etapa activa de un circuito del workspace (el elegido o el
 * predeterminado de su clase). Si ya tiene un recorrido abierto de esa clase, lo devuelve.
 * No toca el estado compatible del registro: entrar al circuito no es un cambio de estado.
 * Lanza si el registro no es del workspace o no hay circuito/etapa donde empezar.
 */
export async function iniciarRecorrido(ctx: CtxCircuitos, sujeto: Sujeto, circuitoId?: string): Promise<{ journeyId: string }> {
  const adaptador = adaptadorDe(sujeto.tipo);
  if (!adaptador) throw new Error(MENSAJES.noEncontrado);
  const { workspaceId } = ctx;

  const buscarAbierto = (tx: Tx, kind: string) =>
    tx.fotofficeJourney.findFirst({
      where: { workspaceId, subjectType: sujeto.tipo, subjectId: sujeto.id, kind, closedAt: null },
      select: { id: true },
    });

  // Clase del circuito elegido, para buscar el recorrido ganador si otra petición se adelantó.
  const leido: { kind: string | null } = { kind: null };
  try {
    return await prisma.$transaction(async (tx) => {
      if (!(await adaptador.existe(tx, workspaceId, sujeto.id))) throw new Error(MENSAJES.noEncontrado);

      const circuito = circuitoId
        ? await tx.fotofficeCircuit.findFirst({ where: { id: circuitoId, workspaceId, isActive: true }, select: { id: true, kind: true } })
        : await circuitoPredeterminado(tx, workspaceId, CLASE_INICIAL[sujeto.tipo]);
      if (!circuito) throw new Error(MENSAJES.sinCircuito);
      leido.kind = circuito.kind;

      const existente = await buscarAbierto(tx, circuito.kind);
      if (existente) return { journeyId: existente.id };

      const primera = await tx.fotofficeStage.findFirst({
        where: { circuitId: circuito.id, circuit: { workspaceId }, archivedAt: null },
        select: { id: true, days: true },
        orderBy: { order: "asc" },
      });
      if (!primera) throw new Error(MENSAJES.sinEtapas);

      const ahora = new Date();
      const j = await tx.fotofficeJourney.create({
        data: {
          workspaceId,
          circuitId: circuito.id,
          kind: circuito.kind,
          subjectType: sujeto.tipo,
          subjectId: sujeto.id,
          stageId: primera.id,
          enteredStageAt: ahora,
          stageDueAt: vencimientoDeEtapa(ahora, primera.days),
          ownerUserId: null,
        },
        select: { id: true, subjectType: true, subjectId: true, ownerUserId: true },
      });
      await tx.fotofficeJourneyStep.create({
        data: {
          journeyId: j.id,
          fromStageId: null,
          toStageId: primera.id,
          auto: ctx.userId === null,
          actorUserId: ctx.userId,
          actorLabel: ctx.userLabel,
          createdAt: ahora,
        },
      });
      await crearTareasDeEtapa(tx, ctx, j, primera.id, ahora);
      return { journeyId: j.id };
    }, OPCIONES_TRANSACCION);
  } catch (error) {
    // Otra petición abrió el recorrido al mismo tiempo (índice único parcial): se usa ése.
    if (esChoqueDeUnicidad(error) && leido.kind !== null) {
      const existente = await buscarAbierto(prisma, leido.kind);
      if (existente) return { journeyId: existente.id };
    }
    throw error;
  }
}

async function circuitoPredeterminado(tx: Tx, workspaceId: string, clase: Clase | undefined) {
  if (!clase) return null;
  const pred = await tx.fotofficeCircuit.findFirst({
    where: { workspaceId, kind: clase, isActive: true, isDefault: true },
    select: { id: true, kind: true },
  });
  if (pred) return pred;
  // Sin predeterminado marcado: el primero activo de esa clase.
  return tx.fotofficeCircuit.findFirst({
    where: { workspaceId, kind: clase, isActive: true },
    select: { id: true, kind: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Mueve un recorrido a otra etapa de su circuito. Todo en una transacción: valida, actualiza el
 * recorrido sólo si nadie lo movió desde `esperado` (o desde lo leído), escribe el paso, crea
 * las tareas de la etapa de destino y actualiza el estado compatible del registro. Si algo
 * falla, no queda nada escrito.
 */
export async function mover(
  ctx: CtxCircuitos,
  journeyId: string,
  destinoId: string,
  opts: { nota?: string; forzar?: boolean; esperado?: Date; auto?: { evento: string } } = {},
): Promise<ResultadoMover> {
  const { workspaceId } = ctx;
  return enTransaccion(async (tx) => {
    const j = await recorridoAbierto(tx, workspaceId, journeyId);
    const etapas = await tx.fotofficeStage.findMany({
      where: { circuitId: j.circuitId, circuit: { workspaceId } },
      select: { id: true, order: true, days: true, archivedAt: true, requireTasks: true, leadStatus: true },
    });
    const actual = etapas.find((e) => e.id === j.stageId);
    const destino = etapas.find((e) => e.id === destinoId);

    // Exigir tareas completas sólo frena el avance: volver atrás no pide terminar nada.
    const requiereTareas = !!actual?.requireTasks && !!destino && !esRetroceso(etapas, j.stageId, destinoId);
    const pendientes = requiereTareas
      ? (
          await tx.fotofficeTask.findMany({
            where: { workspaceId, journeyId: j.id, stageId: j.stageId, required: true, doneAt: null },
            select: { title: true },
            orderBy: { createdAt: "asc" },
          })
        ).map((t) => t.title)
      : [];
    const puedeForzar = puede(ctx.role, "configurar");
    const v = validarMovimiento({
      etapas, actualId: j.stageId, destinoId, requiereTareas, pendientesObligatorias: pendientes,
      forzar: opts.forzar === true, puedeForzar,
    });
    if (!v.ok) {
      if (v.motivo === "OTRO_CIRCUITO") throw new Rechazo(MENSAJES.otroCircuito);
      if (v.motivo === "ARCHIVADA") throw new Rechazo(MENSAJES.archivada);
      if (v.motivo === "MISMA_ETAPA") throw new Rechazo(MENSAJES.mismaEtapa);
      throw new Rechazo(mensajeTareasPendientes(v.pendientes ?? pendientes), v.pendientes ?? pendientes);
    }
    const etapaDestino = destino!;

    const ahora = new Date();
    const actualizado = await tx.fotofficeJourney.updateMany({
      where: { id: j.id, workspaceId, stageId: j.stageId, enteredStageAt: opts.esperado ?? j.enteredStageAt, closedAt: null },
      data: { stageId: etapaDestino.id, enteredStageAt: ahora, stageDueAt: vencimientoDeEtapa(ahora, etapaDestino.days) },
    });
    if (actualizado.count !== 1) throw new Rechazo(MENSAJES.cambio);

    await tx.fotofficeJourneyStep.create({
      data: {
        journeyId: j.id,
        fromStageId: j.stageId,
        toStageId: etapaDestino.id,
        note: opts.nota?.trim() || null,
        auto: !!opts.auto,
        event: opts.auto?.evento ?? null,
        forcedWithPendingTasks: pendientes.length > 0,
        actorUserId: ctx.userId,
        actorLabel: ctx.userLabel,
        createdAt: ahora,
      },
    });
    await crearTareasDeEtapa(tx, ctx, j, etapaDestino.id, ahora);
    await adaptadorDe(j.subjectType)?.alCambiarEtapa?.(tx, workspaceId, j.subjectId, { leadStatus: etapaDestino.leadStatus }, null);
    return { ok: true as const };
  });
}

/**
 * Termina un recorrido con éxito o fracaso de su clase. El fracaso exige un motivo activo del
 * workspace. Las tareas pendientes quedan como están.
 */
export async function cerrar(ctx: CtxCircuitos, journeyId: string, salida: string, lossReasonId?: string, nota?: string): Promise<Resultado> {
  const { workspaceId } = ctx;
  return enTransaccion(async (tx) => {
    const j = await recorridoAbierto(tx, workspaceId, journeyId);
    const salidas = (SALIDAS as Record<string, { exito: string; fracaso: string } | undefined>)[j.kind];
    if (!salidas || (salida !== salidas.exito && salida !== salidas.fracaso)) throw new Rechazo(MENSAJES.salida);

    let motivoId: string | null = null;
    if (salida === salidas.fracaso) {
      const motivo = lossReasonId
        ? await tx.fotofficeLossReason.findFirst({ where: { id: lossReasonId, workspaceId, isActive: true }, select: { id: true } })
        : null;
      if (!motivo) throw new Rechazo(MENSAJES.motivo);
      motivoId = motivo.id;
    }

    const ahora = new Date();
    const actualizado = await tx.fotofficeJourney.updateMany({
      where: { id: j.id, workspaceId, stageId: j.stageId, enteredStageAt: j.enteredStageAt, closedAt: null },
      data: { stageId: null, stageDueAt: null, outcome: salida, lossReasonId: motivoId, closedAt: ahora },
    });
    if (actualizado.count !== 1) throw new Rechazo(MENSAJES.cambio);

    await tx.fotofficeJourneyStep.create({
      data: {
        journeyId: j.id,
        fromStageId: j.stageId,
        toStageId: null,
        outcome: salida,
        note: nota?.trim() || null,
        actorUserId: ctx.userId,
        actorLabel: ctx.userLabel,
        auto: ctx.userId === null,
        createdAt: ahora,
      },
    });
    await adaptadorDe(j.subjectType)?.alCambiarEtapa?.(tx, workspaceId, j.subjectId, null, salida);
    return { ok: true as const };
  });
}

/**
 * Cambia a mano el vencimiento de la etapa actual (null = sin vencimiento). Queda en el
 * historial como un paso de la etapa a sí misma con la nota "Vencimiento cambiado a …".
 */
export async function cambiarVencimiento(ctx: CtxCircuitos, journeyId: string, dueAt: Date | null, nota: string): Promise<Resultado> {
  const { workspaceId } = ctx;
  return enTransaccion(async (tx) => {
    const j = await recorridoAbierto(tx, workspaceId, journeyId);
    const actualizado = await tx.fotofficeJourney.updateMany({
      where: { id: j.id, workspaceId, stageId: j.stageId, enteredStageAt: j.enteredStageAt, closedAt: null },
      data: { stageDueAt: dueAt },
    });
    if (actualizado.count !== 1) throw new Rechazo(MENSAJES.cambio);
    const texto = nota.trim();
    await tx.fotofficeJourneyStep.create({
      data: {
        journeyId: j.id,
        fromStageId: j.stageId,
        toStageId: j.stageId,
        note: `Vencimiento cambiado a ${dueAt ? fechaBA(dueAt) : "sin vencimiento"}.${texto ? ` ${texto}` : ""}`,
        actorUserId: ctx.userId,
        actorLabel: ctx.userLabel,
      },
    });
    return { ok: true as const };
  });
}

/** Asigna (o quita, con null) el responsable del recorrido. Sólo miembros del workspace. */
export async function asignarResponsable(ctx: CtxCircuitos, journeyId: string, userId: number | null): Promise<Resultado> {
  const { workspaceId } = ctx;
  return enTransaccion(async (tx) => {
    const j = await tx.fotofficeJourney.findFirst({ where: { id: journeyId, workspaceId }, select: { id: true } });
    if (!j) throw new Rechazo(MENSAJES.noEncontrado);
    if (userId !== null) {
      const miembro = await tx.workspaceMembership.findFirst({ where: { userId, workspaceId }, select: { id: true } });
      if (!miembro) throw new Rechazo(MENSAJES.noEsDelEquipo);
    }
    await tx.fotofficeJourney.updateMany({ where: { id: j.id, workspaceId }, data: { ownerUserId: userId } });
    return { ok: true as const };
  });
}
