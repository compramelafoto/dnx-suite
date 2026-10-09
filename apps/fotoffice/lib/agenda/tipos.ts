import "server-only";
import { prisma } from "@repo/db";
import { MENSAJES_AGENDA, puedeConfigurarAgenda, puedeVerAgenda, type CtxAgenda } from "./acceso";
import { COLOR_TIPO_POR_OMISION } from "./constantes";

/**
 * Tipos de cita de un workspace (Reunión con cliente, Evento…): nombre, color y orden. Se configuran
 * con `configurar` (dueño o administrador); cualquiera con Ver en Agenda los lee. Un tipo no se borra:
 * se da de baja (las citas que lo usan lo siguen mostrando).
 */

export const NOMBRE_TIPO_MAXIMO = 80;
export const COLOR_VALIDO = /^#[0-9a-fA-F]{6}$/;

export type TipoVisible = { id: string; name: string; color: string; order: number; isActive: boolean };
export type ResultadoTipo = { ok: true; id: string } | { ok: false; error: string };
export type ResultadoSimple = { ok: true } | { ok: false; error: string };

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function clave(s: string): string {
  return s.trim().toLocaleLowerCase("es-AR");
}

function limpiarNombre(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.trim().replace(/\s+/g, " ");
  return n.length >= 1 && n.length <= NOMBRE_TIPO_MAXIMO ? n : null;
}

function limpiarColor(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return COLOR_TIPO_POR_OMISION;
  return typeof v === "string" && COLOR_VALIDO.test(v.trim()) ? v.trim().toLowerCase() : null;
}

/** Los tipos del workspace (por defecto sólo los activos), en orden. */
export async function listarTipos(ctx: CtxAgenda, opciones: { conBajas?: boolean } = {}): Promise<TipoVisible[]> {
  if (!puedeVerAgenda(ctx)) return [];
  const filas = await prisma.fotofficeCitaTipo.findMany({
    where: { workspaceId: ctx.workspaceId, ...(opciones.conBajas ? {} : { isActive: true }) },
    select: { id: true, name: true, color: true, order: true, isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return filas as TipoVisible[];
}

export async function crearTipo(ctx: CtxAgenda, datos: { name?: unknown; color?: unknown }): Promise<ResultadoTipo> {
  if (!puedeConfigurarAgenda(ctx)) return { ok: false, error: MENSAJES_AGENDA.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const name = limpiarNombre(datos.name);
  if (!name) return { ok: false, error: MENSAJES_AGENDA.tipoNombre };
  const color = limpiarColor(datos.color);
  if (!color) return { ok: false, error: MENSAJES_AGENDA.tipoColor };
  try {
    const existentes = await prisma.fotofficeCitaTipo.findMany({ where: { workspaceId: ctx.workspaceId }, select: { name: true, order: true } });
    if (existentes.some((t) => clave(t.name as string) === clave(name))) return { ok: false, error: MENSAJES_AGENDA.tipoRepetido };
    const order = existentes.reduce((m, t) => Math.max(m, t.order as number), -1) + 1;
    const fila = await prisma.fotofficeCitaTipo.create({ data: { workspaceId: ctx.workspaceId, name, color, order }, select: { id: true } });
    return { ok: true, id: fila.id as string };
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "P2002") return { ok: false, error: MENSAJES_AGENDA.tipoRepetido };
    return { ok: false, error: MENSAJES_AGENDA.guardar };
  }
}

/** Cambia nombre, color, orden y/o baja de un tipo (`undefined` = no se toca). */
export async function editarTipo(
  ctx: CtxAgenda,
  tipoId: unknown,
  datos: { name?: unknown; color?: unknown; order?: unknown; isActive?: unknown },
): Promise<ResultadoSimple> {
  if (!puedeConfigurarAgenda(ctx)) return { ok: false, error: MENSAJES_AGENDA.sinPermiso };
  if (!idValido(tipoId) || !datos || typeof datos !== "object") return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const cambios: { name?: string; color?: string; order?: number; isActive?: boolean } = {};
  if (datos.name !== undefined) {
    const n = limpiarNombre(datos.name);
    if (!n) return { ok: false, error: MENSAJES_AGENDA.tipoNombre };
    cambios.name = n;
  }
  if (datos.color !== undefined) {
    const c = limpiarColor(datos.color);
    if (!c) return { ok: false, error: MENSAJES_AGENDA.tipoColor };
    cambios.color = c;
  }
  if (datos.order !== undefined) {
    if (typeof datos.order !== "number" || !Number.isInteger(datos.order) || datos.order < 0 || datos.order > 10_000) {
      return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
    }
    cambios.order = datos.order;
  }
  if (datos.isActive !== undefined) {
    if (typeof datos.isActive !== "boolean") return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
    cambios.isActive = datos.isActive;
  }
  if (Object.keys(cambios).length === 0) return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const { workspaceId } = ctx;
  try {
    const tipo = await prisma.fotofficeCitaTipo.findFirst({ where: { id: tipoId, workspaceId }, select: { id: true } });
    if (!tipo) return { ok: false, error: MENSAJES_AGENDA.tipoNoExiste };
    if (cambios.name) {
      const otros = await prisma.fotofficeCitaTipo.findMany({ where: { workspaceId }, select: { id: true, name: true } });
      if (otros.some((t) => t.id !== tipoId && clave(t.name as string) === clave(cambios.name as string))) {
        return { ok: false, error: MENSAJES_AGENDA.tipoRepetido };
      }
    }
    await prisma.fotofficeCitaTipo.updateMany({ where: { id: tipoId, workspaceId }, data: cambios });
    return { ok: true };
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "P2002") return { ok: false, error: MENSAJES_AGENDA.tipoRepetido };
    return { ok: false, error: MENSAJES_AGENDA.guardar };
  }
}
