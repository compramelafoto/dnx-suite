import "server-only";
import { prisma } from "@repo/db";
import { fechaParaBase } from "@/lib/pedidos/plan";
import { MENSAJES_PROYECTO, puedeGestionarProyectos, type CtxProyectos } from "./acceso";
import { LARGO_MAXIMO_NOMBRE } from "./constantes";
import { fechaValida } from "./fechas";

/**
 * Datos de un proyecto (Etapa 4, Entrega A): editar, suspender y reanudar, y reasignar tareas en
 * lote. Todo pide "Gestionar" en Proyectos y trabaja siempre dentro del workspace de la sesión.
 *
 * - Un proyecto **suspendido** no cuenta como vencido (tablero) ni aparece en "Mis tareas": lo
 *   resuelven `lib/circuitos/tablero.ts` y `lib/circuitos/tareas.ts` mirando `suspendedAt`.
 * - Cambiar el responsable del proyecto cambia también el del recorrido abierto, para que el
 *   tablero y la ficha digan lo mismo.
 */

export type ResultadoProyecto = { ok: true } | { ok: false; error: string };

export const DESCRIPCION_MAXIMA = 5000;
export const MOTIVO_MAXIMO = 1000;

function esEnteroPositivo(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0;
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

export type DatosEdicion = {
  name?: unknown;
  ownerUserId?: unknown;
  delegateUserId?: unknown;
  finalDueDate?: unknown;
  description?: unknown;
};

/**
 * Cambia sólo lo que viene (`undefined` = no se toca; `null` o texto vacío = se borra, salvo el
 * nombre, que es obligatorio). Responsable y delegado tienen que ser del equipo.
 */
export async function editarDatos(ctx: CtxProyectos, proyectoId: unknown, datos: DatosEdicion): Promise<ResultadoProyecto> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId) || !datos || typeof datos !== "object") return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const { workspaceId } = ctx;
  const cambios: {
    name?: string;
    ownerUserId?: number | null;
    delegateUserId?: number | null;
    finalDueDate?: Date | null;
    description?: string | null;
  } = {};

  if (datos.name !== undefined) {
    const nombre = typeof datos.name === "string" ? datos.name.trim().replace(/\s+/g, " ") : "";
    if (nombre.length < 1 || nombre.length > LARGO_MAXIMO_NOMBRE) return { ok: false, error: MENSAJES_PROYECTO.nombre };
    cambios.name = nombre;
  }
  if (datos.ownerUserId !== undefined) {
    if (datos.ownerUserId !== null && !esEnteroPositivo(datos.ownerUserId)) return { ok: false, error: MENSAJES_PROYECTO.responsable };
    cambios.ownerUserId = datos.ownerUserId;
  }
  if (datos.delegateUserId !== undefined) {
    if (datos.delegateUserId !== null && !esEnteroPositivo(datos.delegateUserId)) return { ok: false, error: MENSAJES_PROYECTO.delegado };
    cambios.delegateUserId = datos.delegateUserId;
  }
  if (datos.finalDueDate !== undefined) {
    if (datos.finalDueDate === null || datos.finalDueDate === "") cambios.finalDueDate = null;
    else {
      const f = typeof datos.finalDueDate === "string" ? fechaValida(datos.finalDueDate) : null;
      if (!f) return { ok: false, error: MENSAJES_PROYECTO.fechaFinal };
      cambios.finalDueDate = fechaParaBase(f);
    }
  }
  if (datos.description !== undefined) {
    if (datos.description !== null && typeof datos.description !== "string") return { ok: false, error: MENSAJES_PROYECTO.descripcion };
    const d = (datos.description ?? "").trim();
    if (d.length > DESCRIPCION_MAXIMA) return { ok: false, error: MENSAJES_PROYECTO.descripcion };
    cambios.description = d === "" ? null : d;
  }
  if (Object.keys(cambios).length === 0) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };

  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoProyecto> => {
      const p = await tx.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId }, select: { id: true } });
      if (!p) return { ok: false, error: MENSAJES_PROYECTO.noExiste };
      for (const [campo, error] of [
        ["ownerUserId", MENSAJES_PROYECTO.responsable],
        ["delegateUserId", MENSAJES_PROYECTO.delegado],
      ] as const) {
        const userId = cambios[campo];
        if (userId === undefined || userId === null) continue;
        const miembro = await tx.workspaceMembership.findFirst({ where: { userId, workspaceId }, select: { id: true } });
        if (!miembro) return { ok: false, error };
      }
      await tx.fotofficeProyecto.updateMany({ where: { id: p.id, workspaceId }, data: cambios });
      if (cambios.ownerUserId !== undefined) {
        await tx.fotofficeJourney.updateMany({
          where: { workspaceId, subjectType: "PROYECTO", subjectId: p.id, closedAt: null },
          data: { ownerUserId: cambios.ownerUserId },
        });
      }
      return { ok: true };
    });
  } catch (e) {
    return fallo("editarDatos", e);
  }
}

/** Suspende el proyecto con un motivo obligatorio. Suspender uno ya suspendido es un error. */
export async function suspender(ctx: CtxProyectos, proyectoId: unknown, motivo: unknown, ahora: Date = new Date()): Promise<ResultadoProyecto> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const razon = typeof motivo === "string" ? motivo.trim() : "";
  if (razon.length < 1 || razon.length > MOTIVO_MAXIMO) return { ok: false, error: MENSAJES_PROYECTO.motivo };
  try {
    const p = await prisma.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId: ctx.workspaceId }, select: { id: true, suspendedAt: true } });
    if (!p) return { ok: false, error: MENSAJES_PROYECTO.noExiste };
    if (p.suspendedAt !== null) return { ok: false, error: MENSAJES_PROYECTO.yaSuspendido };
    // Condicionado a "no suspendido": dos suspensiones a la vez no se pisan.
    const r = await prisma.fotofficeProyecto.updateMany({
      where: { id: p.id, workspaceId: ctx.workspaceId, suspendedAt: null },
      data: { suspendedAt: ahora, suspendReason: razon },
    });
    return r.count === 1 ? { ok: true } : { ok: false, error: MENSAJES_PROYECTO.yaSuspendido };
  } catch (e) {
    return fallo("suspender", e);
  }
}

/** Reanuda un proyecto suspendido (borra la fecha y el motivo). */
export async function reanudar(ctx: CtxProyectos, proyectoId: unknown): Promise<ResultadoProyecto> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  try {
    const p = await prisma.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId: ctx.workspaceId }, select: { id: true, suspendedAt: true } });
    if (!p) return { ok: false, error: MENSAJES_PROYECTO.noExiste };
    if (p.suspendedAt === null) return { ok: false, error: MENSAJES_PROYECTO.noSuspendido };
    const r = await prisma.fotofficeProyecto.updateMany({
      where: { id: p.id, workspaceId: ctx.workspaceId, suspendedAt: { not: null } },
      data: { suspendedAt: null, suspendReason: null },
    });
    return r.count === 1 ? { ok: true } : { ok: false, error: MENSAJES_PROYECTO.noSuspendido };
  } catch (e) {
    return fallo("reanudar", e);
  }
}

export type DatosReasignacion = {
  /** Nuevo responsable de las tareas; null las deja sin responsable. */
  haciaUserId: unknown;
  /** Sólo estas tareas. Sin esto: todas las pendientes (filtradas por `desdeUserId` si viene). */
  taskIds?: unknown;
  /** Sólo las pendientes de esta persona (null = las que no tienen responsable). */
  desdeUserId?: unknown;
};

export type ResultadoReasignacion = { ok: true; reasignadas: number } | { ok: false; error: string };

/**
 * Reasigna en lote las tareas PENDIENTES de un proyecto a otra persona del equipo. Las ya hechas
 * no se tocan. Con `taskIds`, cada una tiene que ser una tarea pendiente de este proyecto.
 */
export async function reasignarTareas(ctx: CtxProyectos, proyectoId: unknown, datos: DatosReasignacion): Promise<ResultadoReasignacion> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId) || !datos || typeof datos !== "object") return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  if (datos.haciaUserId !== null && !esEnteroPositivo(datos.haciaUserId)) return { ok: false, error: MENSAJES_PROYECTO.responsable };
  const hacia = datos.haciaUserId;
  let ids: string[] | null = null;
  if (datos.taskIds !== undefined) {
    if (!Array.isArray(datos.taskIds) || datos.taskIds.length === 0 || datos.taskIds.length > 500 || !datos.taskIds.every(idValido)) {
      return { ok: false, error: MENSAJES_PROYECTO.tareas };
    }
    ids = [...new Set(datos.taskIds as string[])];
  }
  const desde = datos.desdeUserId;
  if (desde !== undefined && desde !== null && !esEnteroPositivo(desde)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const { workspaceId } = ctx;

  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoReasignacion> => {
      const p = await tx.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId }, select: { id: true } });
      if (!p) return { ok: false, error: MENSAJES_PROYECTO.noExiste };
      if (hacia !== null) {
        const miembro = await tx.workspaceMembership.findFirst({ where: { userId: hacia, workspaceId }, select: { id: true } });
        if (!miembro) return { ok: false, error: MENSAJES_PROYECTO.responsable };
      }
      const donde = {
        workspaceId,
        subjectType: "PROYECTO",
        subjectId: p.id,
        doneAt: null,
        ...(ids ? { id: { in: ids } } : {}),
        ...(desde !== undefined ? { assigneeUserId: desde } : {}),
      };
      if (ids) {
        // Todas las elegidas tienen que ser tareas pendientes de ESTE proyecto: una ajena o ya hecha corta todo.
        const validas = await tx.fotofficeTask.count({ where: donde });
        if (validas !== ids.length) return { ok: false, error: MENSAJES_PROYECTO.tareas };
      }
      const r = await tx.fotofficeTask.updateMany({ where: donde, data: { assigneeUserId: hacia } });
      if (r.count === 0) return { ok: false, error: MENSAJES_PROYECTO.sinTareas };
      return { ok: true, reasignadas: r.count };
    });
  } catch (e) {
    return fallo("reasignarTareas", e);
  }
}

/** Ids de los proyectos suspendidos entre los dados (del workspace). */
export async function suspendidosEntre(workspaceId: string, ids: readonly string[]): Promise<Set<string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Set();
  const filas = await prisma.fotofficeProyecto.findMany({
    where: { workspaceId, id: { in: unicos }, suspendedAt: { not: null } },
    select: { id: true },
  });
  return new Set(filas.map((f) => f.id as string));
}

function fallo(que: string, e: unknown): { ok: false; error: string } {
  const codigo = (e as { code?: unknown } | null)?.code;
  console.error(`[proyectos] ${que} falló`, { codigo: typeof codigo === "string" ? codigo : null });
  return { ok: false, error: MENSAJES_PROYECTO.guardar };
}
