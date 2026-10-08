import "server-only";
import { prisma } from "@repo/db";
import { MENSAJES_PRESUPUESTO, puedeConfigurarPresupuestos, type CtxPresupuestos } from "./acceso";

/**
 * Interruptor del borrador automático por categoría de consulta (`FotofficePropuestaBorradorAuto`):
 * la fila existe = encendido. Es una tabla aparte para que publicar el código antes del SQL no rompa
 * nada: leer ante cualquier error (por ejemplo, la tabla todavía no existe) devuelve "apagado".
 *
 * Nunca loguea datos personales.
 */

export const MENSAJES_BORRADOR_AUTO = {
  sinPermiso: MENSAJES_PRESUPUESTO.sinPermisoAjustes,
  datosInvalidos: MENSAJES_PRESUPUESTO.datosInvalidos,
  categoria: "No encontramos esa categoría.",
  fallo: "No se pudo guardar. ¿Ya se aplicó el SQL del borrador automático?",
} as const;

export type ResultadoBorradorAuto = { ok: true } | { ok: false; error: string };

const no = (error: string): ResultadoBorradorAuto => ({ ok: false, error });

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function falla(donde: string, error: unknown): void {
  const e = error as { code?: unknown } | null;
  console.error(`[presupuestos] ${donde} falló`, { codigo: typeof e?.code === "string" ? e.code : null });
}

/** (Sistema) ¿La categoría arma el borrador sola? Ante cualquier error, false. */
export async function armaBorradorAuto(workspaceId: string, categoriaId: string): Promise<boolean> {
  try {
    const f = await prisma.fotofficePropuestaBorradorAuto.findFirst({
      where: { workspaceId, categoryId: categoriaId },
      select: { id: true },
    });
    return f !== null;
  } catch (e) {
    falla("armaBorradorAuto", e);
    return false;
  }
}

/** Las categorías del workspace con el borrador automático encendido; null si la tabla falta o hay error. */
export async function categoriasConBorradorAuto(workspaceId: string): Promise<Set<string> | null> {
  try {
    const filas = await prisma.fotofficePropuestaBorradorAuto.findMany({
      where: { workspaceId },
      select: { categoryId: true },
      take: 500,
    });
    return new Set(filas.map((f) => f.categoryId));
  } catch (e) {
    falla("categoriasConBorradorAuto", e);
    return null;
  }
}

/** Enciende (crea la fila) o apaga (la borra) el borrador automático de una categoría. Exige `configurar`. */
export async function guardarBorradorAuto(ctx: CtxPresupuestos, categoriaId: unknown, encendido: unknown): Promise<ResultadoBorradorAuto> {
  if (!puedeConfigurarPresupuestos(ctx)) return no(MENSAJES_BORRADOR_AUTO.sinPermiso);
  if (!idValido(categoriaId) || typeof encendido !== "boolean") return no(MENSAJES_BORRADOR_AUTO.datosInvalidos);
  const { workspaceId } = ctx;
  try {
    const categoria = await prisma.fotofficeConsultaCategoria.findFirst({
      where: { id: categoriaId, workspaceId, archivedAt: null },
      select: { id: true },
    });
    if (!categoria) return no(MENSAJES_BORRADOR_AUTO.categoria);
    if (encendido) {
      await prisma.fotofficePropuestaBorradorAuto.upsert({
        where: { workspaceId_categoryId: { workspaceId, categoryId: categoriaId } },
        create: { workspaceId, categoryId: categoriaId, createdByUserId: ctx.userId },
        update: {},
        select: { id: true },
      });
    } else {
      await prisma.fotofficePropuestaBorradorAuto.deleteMany({ where: { workspaceId, categoryId: categoriaId } });
    }
  } catch (e) {
    // Dos pestañas la encendieron a la vez: el único frena a una y el resultado es el mismo.
    if (encendido && (e as { code?: unknown } | null)?.code === "P2002") return { ok: true };
    falla("guardarBorradorAuto", e);
    return no(MENSAJES_BORRADOR_AUTO.fallo);
  }
  return { ok: true };
}
