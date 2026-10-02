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

/**
 * Un movimiento escribe recorrido, paso, tareas y el estado del sujeto: el tope por defecto (5 s) es justo en Neon.
 *
 * Sin `isolationLevel`: corre con el de la base, READ COMMITTED en Postgres. Los controles de
 * carrera del motor dependen de eso —el `updateMany` condicionado a lo leído y, en el enganche
 * de consultas, volver a mirar después del bloqueo ven lo que otra transacción ya confirmó—.
 * Con REPEATABLE READ o SERIALIZABLE esa segunda mirada vería la foto vieja (o la base
 * abortaría con errores de serialización): revisar esos controles antes de cambiarlo.
 */
export const OPCIONES_TRANSACCION = { timeout: 15_000 };

/**
 * Fechas de una importación (el enganche de consultas existentes): el paso y la entrada a la
 * etapa (o el cierre) quedan con la fecha histórica `fecha` y el paso lleva `nota`. Los
 * vencimientos —de la etapa y de sus tareas— se cuentan desde ahora: el motor empieza a
 * seguir la consulta hoy, y contarlos desde la fecha vieja la mostraría vencida de entrada.
 */
export type Importacion = { fecha: Date; nota: string };

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

/** Un rechazo esperado del motor (lanzado por las variantes `…EnTransaccion`). */
export function esRechazo(error: unknown): error is Rechazo {
  return error instanceof Rechazo;
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

function buscarRecorridoAbierto(tx: Tx, workspaceId: string, sujeto: Sujeto, kind: string) {
  return tx.fotofficeJourney.findFirst({
    where: { workspaceId, subjectType: sujeto.tipo, subjectId: sujeto.id, kind, closedAt: null },
    select: { id: true },
  });
}

/**
 * Variante de `iniciarRecorrido` dentro de una transacción ajena (lanza `Error` si no puede
 * empezar). `leido.kind` queda con la clase del circuito, para resolver carreras afuera.
 */
export async function iniciarEnTransaccion(
  tx: Tx,
  ctx: CtxCircuitos,
  sujeto: Sujeto,
  circuitoId?: string,
  leido?: { kind: string | null },
  importacion?: Importacion,
): Promise<{ journeyId: string }> {
  const adaptador = adaptadorDe(sujeto.tipo);
  if (!adaptador) throw new Error(MENSAJES.noEncontrado);
  const { workspaceId } = ctx;
  if (!(await adaptador.existe(tx, workspaceId, sujeto.id))) throw new Error(MENSAJES.noEncontrado);

  const circuito = circuitoId
    ? await tx.fotofficeCircuit.findFirst({ where: { id: circuitoId, workspaceId, isActive: true }, select: { id: true, kind: true } })
    : await circuitoPredeterminado(tx, workspaceId, CLASE_INICIAL[sujeto.tipo]);
  if (!circuito) throw new Error(MENSAJES.sinCircuito);
  if (leido) leido.kind = circuito.kind;

  const existente = await buscarRecorridoAbierto(tx, workspaceId, sujeto, circuito.kind);
  if (existente) return { journeyId: existente.id };

  const primera = await tx.fotofficeStage.findFirst({
    where: { circuitId: circuito.id, circuit: { workspaceId }, archivedAt: null },
    select: { id: true, days: true },
    orderBy: { order: "asc" },
  });
  if (!primera) throw new Error(MENSAJES.sinEtapas);

  const ahora = new Date();
  const entrada = importacion?.fecha ?? ahora;
  const j = await tx.fotofficeJourney.create({
    data: {
      workspaceId,
      circuitId: circuito.id,
      kind: circuito.kind,
      subjectType: sujeto.tipo,
      subjectId: sujeto.id,
      stageId: primera.id,
      enteredStageAt: entrada,
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
      note: importacion?.nota ?? null,
      auto: ctx.userId === null,
      actorUserId: ctx.userId,
      actorLabel: ctx.userLabel,
      createdAt: entrada,
    },
  });
  await crearTareasDeEtapa(tx, ctx, j, primera.id, ahora);
  return { journeyId: j.id };
}

/**
 * Pone un registro en la primera etapa activa de un circuito del workspace (el elegido o el
 * predeterminado de su clase). Si ya tiene un recorrido abierto de esa clase, lo devuelve.
 * No toca el estado compatible del registro: entrar al circuito no es un cambio de estado.
 * Lanza si el registro no es del workspace o no hay circuito/etapa donde empezar.
 */
export async function iniciarRecorrido(ctx: CtxCircuitos, sujeto: Sujeto, circuitoId?: string): Promise<{ journeyId: string }> {
  if (!adaptadorDe(sujeto.tipo)) throw new Error(MENSAJES.noEncontrado);
  // Clase del circuito elegido, para buscar el recorrido ganador si otra petición se adelantó.
  const leido: { kind: string | null } = { kind: null };
  try {
    return await prisma.$transaction((tx) => iniciarEnTransaccion(tx, ctx, sujeto, circuitoId, leido), OPCIONES_TRANSACCION);
  } catch (error) {
    // Otra petición abrió el recorrido al mismo tiempo (índice único parcial): se usa ése.
    if (esChoqueDeUnicidad(error) && leido.kind !== null) {
      const existente = await buscarRecorridoAbierto(prisma, ctx.workspaceId, sujeto, leido.kind);
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
  return enTransaccion((tx) => moverEnTransaccion(tx, ctx, journeyId, destinoId, opts));
}

/** Variante de `mover` dentro de una transacción ajena: los rechazos se lanzan (`esRechazo`). */
export async function moverEnTransaccion(
  tx: Tx,
  ctx: CtxCircuitos,
  journeyId: string,
  destinoId: string,
  opts: { nota?: string; forzar?: boolean; esperado?: Date; auto?: { evento: string }; fecha?: Date } = {},
): Promise<{ ok: true }> {
  const { workspaceId } = ctx;
  const j = await recorridoAbierto(tx, workspaceId, journeyId);
  const etapas = await tx.fotofficeStage.findMany({
    where: { circuitId: j.circuitId, circuit: { workspaceId } },
    select: { id: true, order: true, days: true, archivedAt: true, requireTasks: true, leadStatus: true },
  });
  const actual = etapas.find((e) => e.id === j.stageId);
  const destino = etapas.find((e) => e.id === destinoId);

  // Exigir tareas completas sólo frena el avance: volver atrás no pide terminar nada.
  const requiereTareas = !!actual?.requireTasks && !!destino && !esRetroceso(etapas, j.stageId, destinoId);
  const pendientes = requiereTareas ? await obligatoriasPendientes(tx, workspaceId, j.id, j.stageId) : [];
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
  // `fecha` sólo la usa la importación (ver `Importacion`): el vencimiento se cuenta desde ahora.
  const entrada = opts.fecha ?? ahora;
  const actualizado = await tx.fotofficeJourney.updateMany({
    where: { id: j.id, workspaceId, stageId: j.stageId, enteredStageAt: opts.esperado ?? j.enteredStageAt, closedAt: null },
    data: { stageId: etapaDestino.id, enteredStageAt: entrada, stageDueAt: vencimientoDeEtapa(ahora, etapaDestino.days) },
  });
  if (actualizado.count !== 1) throw new Rechazo(MENSAJES.cambio);

  await tx.fotofficeJourneyStep.create({
    data: {
      journeyId: j.id,
      fromStageId: j.stageId,
      toStageId: etapaDestino.id,
      note: opts.nota?.trim() || null,
      // Automático = lo hizo el Sistema (por un evento o por la importación de consultas).
      auto: !!opts.auto || ctx.userId === null,
      event: opts.auto?.evento ?? null,
      forcedWithPendingTasks: pendientes.length > 0,
      actorUserId: ctx.userId,
      actorLabel: ctx.userLabel,
      createdAt: entrada,
    },
  });
  await crearTareasDeEtapa(tx, ctx, j, etapaDestino.id, ahora);
  await adaptadorDe(j.subjectType)?.alCambiarEtapa?.(tx, workspaceId, j.subjectId, { leadStatus: etapaDestino.leadStatus }, null);
  return { ok: true as const };
}


/** Títulos de las tareas obligatorias sin tildar de la etapa en la que está el recorrido. */
async function obligatoriasPendientes(tx: Tx, workspaceId: string, journeyId: string, stageId: string): Promise<string[]> {
  const filas = await tx.fotofficeTask.findMany({
    where: { workspaceId, journeyId, stageId, required: true, doneAt: null },
    select: { title: true },
    orderBy: { createdAt: "asc" },
  });
  return filas.map((t) => t.title);
}

/**
 * Termina un recorrido con éxito o fracaso de su clase. El fracaso exige un motivo activo del
 * workspace. El éxito cuenta como avance: si la etapa actual exige tareas completas y faltan
 * obligatorias, se frena salvo que quien puede `configurar` lo fuerce (queda registrado).
 * Con `esperado`, sólo cierra si el recorrido sigue en la etapa desde ese momento. Las tareas
 * pendientes quedan como están.
 *
 * `deSistema` es interno (nunca viene de un formulario): cuando el Sistema (`userId: null`)
 * registra un éxito que otro módulo ya dio por hecho —p. ej. se aprobó una inscripción—, las
 * obligatorias pendientes no lo frenan y el paso queda marcado como forzado. Con un usuario,
 * no tiene efecto.
 */
export async function cerrar(
  ctx: CtxCircuitos,
  journeyId: string,
  salida: string,
  lossReasonId?: string,
  nota?: string,
  opts: { esperado?: Date; forzar?: boolean; deSistema?: boolean } = {},
): Promise<ResultadoMover> {
  return enTransaccion((tx) => cerrarEnTransaccion(tx, ctx, journeyId, salida, lossReasonId, nota, opts));
}

/** Variante de `cerrar` dentro de una transacción ajena: los rechazos se lanzan (`esRechazo`). */
export async function cerrarEnTransaccion(
  tx: Tx,
  ctx: CtxCircuitos,
  journeyId: string,
  salida: string,
  lossReasonId?: string,
  nota?: string,
  opts: { esperado?: Date; forzar?: boolean; deSistema?: boolean; fecha?: Date } = {},
): Promise<{ ok: true }> {
  const { workspaceId } = ctx;
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

  let pendientes: string[] = [];
  if (salida === salidas.exito) {
    const actual = await tx.fotofficeStage.findFirst({
      where: { id: j.stageId, circuit: { workspaceId } },
      select: { requireTasks: true },
    });
    if (actual?.requireTasks) pendientes = await obligatoriasPendientes(tx, workspaceId, j.id, j.stageId);
    const fuerzaElSistema = opts.deSistema === true && ctx.userId === null;
    if (pendientes.length > 0 && !fuerzaElSistema && !(opts.forzar === true && puede(ctx.role, "configurar"))) {
      throw new Rechazo(mensajeTareasPendientes(pendientes), pendientes);
    }
  }

  // `fecha` sólo la usa la importación (ver `Importacion`).
  const cierre = opts.fecha ?? new Date();
  const actualizado = await tx.fotofficeJourney.updateMany({
    where: { id: j.id, workspaceId, stageId: j.stageId, enteredStageAt: opts.esperado ?? j.enteredStageAt, closedAt: null },
    data: { stageId: null, stageDueAt: null, outcome: salida, lossReasonId: motivoId, closedAt: cierre },
  });
  if (actualizado.count !== 1) throw new Rechazo(MENSAJES.cambio);

  await tx.fotofficeJourneyStep.create({
    data: {
      journeyId: j.id,
      fromStageId: j.stageId,
      toStageId: null,
      outcome: salida,
      note: nota?.trim() || null,
      forcedWithPendingTasks: pendientes.length > 0,
      actorUserId: ctx.userId,
      actorLabel: ctx.userLabel,
      auto: ctx.userId === null,
      createdAt: cierre,
    },
  });
  await adaptadorDe(j.subjectType)?.alCambiarEtapa?.(tx, workspaceId, j.subjectId, null, salida);
  return { ok: true as const };
}


/**
 * Cambia a mano el vencimiento de la etapa actual (null = sin vencimiento). Queda en el
 * historial como un paso de la etapa a sí misma con la nota "Vencimiento cambiado a …".
 * Con `esperado`, sólo lo cambia si el recorrido sigue en la etapa desde ese momento.
 */
export async function cambiarVencimiento(
  ctx: CtxCircuitos,
  journeyId: string,
  dueAt: Date | null,
  nota: string,
  opts: { esperado?: Date } = {},
): Promise<Resultado> {
  const { workspaceId } = ctx;
  return enTransaccion(async (tx) => {
    const j = await recorridoAbierto(tx, workspaceId, journeyId);
    const actualizado = await tx.fotofficeJourney.updateMany({
      where: { id: j.id, workspaceId, stageId: j.stageId, enteredStageAt: opts.esperado ?? j.enteredStageAt, closedAt: null },
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

/** Asigna (o quita, con null) el responsable de un recorrido abierto. Sólo miembros del workspace. */
export async function asignarResponsable(ctx: CtxCircuitos, journeyId: string, userId: number | null): Promise<Resultado> {
  const { workspaceId } = ctx;
  return enTransaccion(async (tx) => {
    const j = await tx.fotofficeJourney.findFirst({ where: { id: journeyId, workspaceId }, select: { id: true, closedAt: true } });
    if (!j) throw new Rechazo(MENSAJES.noEncontrado);
    if (j.closedAt !== null) throw new Rechazo(MENSAJES.cerrado);
    if (userId !== null) {
      const miembro = await tx.workspaceMembership.findFirst({ where: { userId, workspaceId }, select: { id: true } });
      if (!miembro) throw new Rechazo(MENSAJES.noEsDelEquipo);
    }
    const actualizado = await tx.fotofficeJourney.updateMany({ where: { id: j.id, workspaceId, closedAt: null }, data: { ownerUserId: userId } });
    if (actualizado.count !== 1) throw new Rechazo(MENSAJES.cerrado);
    return { ok: true as const };
  });
}

/** El registro que recorre este recorrido del workspace (null si no existe o es ajeno). */
export async function sujetoDeRecorrido(workspaceId: string, journeyId: string): Promise<Sujeto | null> {
  const j = await prisma.fotofficeJourney.findFirst({ where: { id: journeyId, workspaceId }, select: { subjectType: true, subjectId: true } });
  return j ? { tipo: j.subjectType as TipoSujeto, id: j.subjectId } : null;
}
