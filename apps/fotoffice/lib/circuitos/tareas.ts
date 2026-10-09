import "server-only";
import { prisma } from "@repo/db";
import { hoyEnBuenosAires } from "../listado/periodos";
import type { TipoSujeto } from "./constantes";
import { MENSAJES, type Resultado } from "./recorridos";
import { adaptadorDe, type NombreDeSujeto, type Sujeto } from "./sujetos";
import { suspendidosEntre } from "@/lib/proyectos/proyectos";
import type { CtxCircuitos } from "./acceso";

export const TITULO_MAX = 200;
export const MENSAJE_TITULO = `Escribí un título de hasta ${TITULO_MAX} caracteres.`;
export const MENSAJE_FECHA = "La fecha no es válida.";
export const MENSAJE_NO_SUELTA = "Sólo se pueden borrar las tareas agregadas a mano.";

/**
 * Una tarea "suelta" es la que se agregó a mano: no viene de una tarea modelo de etapa, así que
 * no tiene etapa (`stageId = null`). Las de etapa se tildan pero no se borran.
 */
export type TareaDeRecorrido = {
  id: string;
  titulo: string;
  vence: Date | null;
  hecha: boolean;
  obligatoria: boolean;
  etapa: string | null;
  suelta: boolean;
  responsableId: number | null;
};

export type TareaVista = {
  id: string;
  titulo: string;
  vence: Date | null;
  obligatoria: boolean;
  etapa: string | null;
  sujeto: NombreDeSujeto | null;
};

const DIA_MS = 24 * 60 * 60 * 1000;

function fechaValida(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/** Tilda o destilda una tarea del workspace. Tildar una ya tildada no cambia quién ni cuándo. */
export async function tildarTarea(ctx: CtxCircuitos, id: string, hecha: boolean): Promise<Resultado> {
  const t = await prisma.fotofficeTask.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true, doneAt: true } });
  if (!t) return { ok: false, error: MENSAJES.noEncontrado };
  if (hecha === (t.doneAt !== null)) return { ok: true };
  await prisma.fotofficeTask.updateMany({
    where: { id: t.id, workspaceId: ctx.workspaceId },
    data: hecha ? { doneAt: new Date(), doneByUserId: ctx.userId } : { doneAt: null, doneByUserId: null },
  });
  return { ok: true };
}

/** Suma una tarea a mano a un recorrido abierto del workspace. */
export async function crearTareaSuelta(
  ctx: CtxCircuitos,
  journeyId: string,
  datos: { titulo: string; dueAt?: Date | null; assigneeUserId?: number | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const titulo = typeof datos.titulo === "string" ? datos.titulo.trim() : "";
  if (titulo.length < 1 || titulo.length > TITULO_MAX) return { ok: false, error: MENSAJE_TITULO };
  const dueAt = datos.dueAt ?? null;
  if (dueAt !== null && !fechaValida(dueAt)) return { ok: false, error: MENSAJE_FECHA };

  const j = await prisma.fotofficeJourney.findFirst({
    where: { id: journeyId, workspaceId: ctx.workspaceId },
    select: { id: true, subjectType: true, subjectId: true, closedAt: true },
  });
  if (!j) return { ok: false, error: MENSAJES.noEncontrado };
  if (j.closedAt !== null) return { ok: false, error: MENSAJES.cerrado };

  const responsable = datos.assigneeUserId ?? null;
  if (responsable !== null) {
    const miembro = await prisma.workspaceMembership.findFirst({ where: { userId: responsable, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!miembro) return { ok: false, error: MENSAJES.noEsDelEquipo };
  }

  const creada = await prisma.fotofficeTask.create({
    data: {
      workspaceId: ctx.workspaceId,
      journeyId: j.id,
      stageId: null,
      subjectType: j.subjectType,
      subjectId: j.subjectId,
      title: titulo,
      dueAt,
      required: false,
      assigneeUserId: responsable,
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  });
  return { ok: true, id: creada.id };
}

/** Borra una tarea agregada a mano. Las que vienen de una etapa no se borran. */
export async function borrarTareaSuelta(ctx: CtxCircuitos, id: string): Promise<Resultado> {
  const t = await prisma.fotofficeTask.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true, stageId: true } });
  if (!t) return { ok: false, error: MENSAJES.noEncontrado };
  if (t.stageId !== null) return { ok: false, error: MENSAJE_NO_SUELTA };
  await prisma.fotofficeTask.deleteMany({ where: { id: t.id, workspaceId: ctx.workspaceId, stageId: null } });
  return { ok: true };
}

/** El registro al que pertenece una tarea del workspace (null si no existe o es ajena). */
export async function sujetoDeTarea(workspaceId: string, id: string): Promise<Sujeto | null> {
  const t = await prisma.fotofficeTask.findFirst({ where: { id, workspaceId }, select: { subjectType: true, subjectId: true } });
  return t ? { tipo: t.subjectType as TipoSujeto, id: t.subjectId } : null;
}

/** Nombre de cada etapa, sólo de circuitos del workspace. */
async function nombresDeEtapas(workspaceId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => x !== null))];
  if (unicos.length === 0) return new Map();
  const etapas = await prisma.fotofficeStage.findMany({
    where: { id: { in: unicos }, circuit: { workspaceId } },
    select: { id: true, name: true },
  });
  return new Map(etapas.map((e) => [e.id, e.name]));
}

/** Todas las tareas de un recorrido del workspace, en el orden en que se crearon. */
export async function tareasDeRecorrido(workspaceId: string, journeyId: string): Promise<TareaDeRecorrido[]> {
  const filas = await prisma.fotofficeTask.findMany({
    where: { workspaceId, journeyId, journey: { workspaceId } },
    select: { id: true, title: true, dueAt: true, doneAt: true, required: true, stageId: true, assigneeUserId: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const etapas = await nombresDeEtapas(workspaceId, filas.map((f) => f.stageId));
  return filas.map((f) => ({
    id: f.id,
    titulo: f.title,
    vence: f.dueAt,
    hecha: f.doneAt !== null,
    obligatoria: f.required,
    etapa: f.stageId ? (etapas.get(f.stageId) ?? null) : null,
    suelta: f.stageId === null,
    responsableId: f.assigneeUserId,
  }));
}

/** Inicio (00:00 de Buenos Aires) del día de `ahora`. */
function inicioDelDia(ahora: Date): Date {
  return new Date(`${hoyEnBuenosAires(ahora)}T00:00:00.000-03:00`);
}

/**
 * Tareas pendientes asignadas a quien opera, de recorridos abiertos del workspace, en tres
 * grupos según el día de hoy en Buenos Aires: vencidas (antes de hoy), hoy, y próximas (hasta 7
 * días después de hoy). Las que no tienen vencimiento no aparecen. Las de un proyecto suspendido
 * tampoco aparecen: se retoman al reanudarlo.
 */
export async function misTareas(
  ctx: CtxCircuitos,
  hoy: Date,
): Promise<{ vencidas: TareaVista[]; hoy: TareaVista[]; proximas: TareaVista[] }> {
  const grupos = { vencidas: [] as TareaVista[], hoy: [] as TareaVista[], proximas: [] as TareaVista[] };
  if (ctx.userId === null) return grupos;
  const inicioHoy = inicioDelDia(hoy);
  const inicioManana = new Date(inicioHoy.getTime() + DIA_MS);
  const limite = new Date(inicioHoy.getTime() + 8 * DIA_MS); // fin del día hoy + 7

  const filas = await prisma.fotofficeTask.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      assigneeUserId: ctx.userId,
      doneAt: null,
      dueAt: { not: null, lt: limite },
      journey: { workspaceId: ctx.workspaceId, closedAt: null },
    },
    select: { id: true, title: true, dueAt: true, required: true, stageId: true, subjectType: true, subjectId: true },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    take: 500,
  });

  const suspendidos = await suspendidosEntre(ctx.workspaceId, filas.filter((f) => f.subjectType === "PROYECTO").map((f) => f.subjectId));
  if (suspendidos.size > 0) {
    for (let i = filas.length - 1; i >= 0; i--) {
      if (filas[i]!.subjectType === "PROYECTO" && suspendidos.has(filas[i]!.subjectId)) filas.splice(i, 1);
    }
  }

  const etapas = await nombresDeEtapas(ctx.workspaceId, filas.map((f) => f.stageId));
  const nombres = new Map<string, Map<string, NombreDeSujeto>>();
  for (const tipo of new Set(filas.map((f) => f.subjectType))) {
    const adaptador = adaptadorDe(tipo);
    if (!adaptador) continue;
    const ids = filas.filter((f) => f.subjectType === tipo).map((f) => f.subjectId);
    nombres.set(tipo, await adaptador.nombre(ctx.workspaceId, ids));
  }

  for (const f of filas) {
    const vence = f.dueAt!;
    const vista: TareaVista = {
      id: f.id,
      titulo: f.title,
      vence,
      obligatoria: f.required,
      etapa: f.stageId ? (etapas.get(f.stageId) ?? null) : null,
      sujeto: nombres.get(f.subjectType)?.get(f.subjectId) ?? null,
    };
    if (vence < inicioHoy) grupos.vencidas.push(vista);
    else if (vence < inicioManana) grupos.hoy.push(vista);
    else grupos.proximas.push(vista);
  }
  return grupos;
}
