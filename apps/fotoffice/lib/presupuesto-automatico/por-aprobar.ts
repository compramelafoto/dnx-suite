import "server-only";
import { prisma } from "@repo/db";
import { puedeGestionarPresupuestos, type CtxPresupuestos } from "@/lib/presupuestos/acceso";
import { aprobarYEnviar, ESTADOS_APROBABLES, origenDeFila, presupuestoDelResumen, type DepsFlujo, type OrigenConsulta, type ResultadoAprobar } from "./flujo";
import { precioDeLaFila } from "./por-aprobar-puro";

/**
 * Las cotizaciones que armó el bot y esperan aprobación, vistas desde Presupuestos (no desde
 * Configuración → Telegram):
 *
 * - `listarPorAprobar`: una fila por aprobación pendiente (AVISADO o AVISO_FALLIDO, con
 *   presupuesto), de la más nueva a la más vieja. Antes de leer archiva las de más de
 *   `DIAS_PARA_ARCHIVAR` días.
 * - `aprobacionDelPresupuesto`: la pendiente de un presupuesto (el aviso arriba del editor).
 * - `aprobarDesdeElPanel`: el mismo camino que el botón de Telegram (`aprobarYEnviar` con PANEL).
 * - `descartarAprobacion`: la archiva a mano.
 *
 * ARCHIVADO es un estado más de la columna `status` (texto, sin SQL): no aparece en la lista, no
 * se puede aprobar y no frena que el bot cotice otra consulta del mismo número.
 */

export const DIAS_PARA_ARCHIVAR = 14;
export const ESTADO_ARCHIVADO = "ARCHIVADO";

export const MENSAJES_POR_APROBAR = {
  sinPermiso: "No tenés permiso para aprobar cotizaciones.",
  datosInvalidos: "No encontramos esa cotización.",
  yaNoEspera: "Esta cotización ya no espera aprobación.",
} as const;

export type FilaPorAprobar = {
  id: string;
  presupuestoId: string;
  leadId: string;
  /** Nombre del cliente o, si no hay, su teléfono. */
  cliente: string;
  categoria: string | null;
  /** Cuándo entró la consulta. */
  fecha: Date;
  /** "$ 1.100.000" o, con opciones, "$ 800.000 a $ 1.400.000". null si no se pudo leer. */
  precio: string | null;
  origen: OrigenConsulta;
  /** No se pudo avisar por Telegram. */
  sinAviso: boolean;
  errorCode: string | null;
};

/** Desde cuándo una pendiente sigue viva. */
export function limiteDeArchivo(ahora: Date): Date {
  return new Date(ahora.getTime() - DIAS_PARA_ARCHIVAR * 86_400_000);
}

/** Las que se ven en la lista (exportada para probarla). */
export function condicionPorAprobar(workspaceId: string, ahora: Date) {
  return {
    workspaceId,
    status: { in: [...ESTADOS_APROBABLES] },
    presupuestoId: { not: null },
    createdAt: { gte: limiteDeArchivo(ahora) },
  };
}

/** Archiva las pendientes de más de 14 días. Devuelve cuántas. Nunca lanza. */
export async function archivarViejas(workspaceId: string, ahora: Date = new Date()): Promise<number> {
  try {
    const r = await prisma.fotofficePresupuestoAprobacion.updateMany({
      where: { workspaceId, status: { in: [...ESTADOS_APROBABLES, "SIN_PROPUESTA"] }, createdAt: { lt: limiteDeArchivo(ahora) } },
      data: { status: ESTADO_ARCHIVADO, errorCode: "ANTIGUEDAD" },
    });
    return r.count;
  } catch {
    return 0;
  }
}

export async function listarPorAprobar(workspaceId: string, ahora: Date = new Date()): Promise<FilaPorAprobar[]> {
  try {
    await archivarViejas(workspaceId, ahora);
    const filas = await prisma.fotofficePresupuestoAprobacion.findMany({
      where: condicionPorAprobar(workspaceId, ahora),
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, leadId: true, presupuestoId: true, categoryId: true, origin: true, status: true, errorCode: true, waId: true, createdAt: true },
    });
    if (filas.length === 0) return [];
    const [leads, categorias] = await Promise.all([
      prisma.serviceSalesLead.findMany({ where: { workspaceId, id: { in: filas.map((f) => f.leadId) } }, select: { id: true, name: true, phone: true } }),
      prisma.fotofficeConsultaCategoria.findMany({
        where: { workspaceId, id: { in: filas.map((f) => f.categoryId).filter((x): x is string => !!x) } },
        select: { id: true, name: true },
      }),
    ]);
    const lead = new Map(leads.map((l) => [l.id, l]));
    const cat = new Map(categorias.map((c) => [c.id, c.name]));
    return await Promise.all(
      filas.map(async (f) => {
        const l = lead.get(f.leadId);
        const resumen = await presupuestoDelResumen(workspaceId, f.presupuestoId!).catch(() => null);
        return {
          id: f.id,
          presupuestoId: f.presupuestoId!,
          leadId: f.leadId,
          cliente: l?.name?.trim() || l?.phone?.trim() || (f.waId ? `+${f.waId}` : "Sin nombre"),
          categoria: f.categoryId ? cat.get(f.categoryId) ?? null : null,
          fecha: f.createdAt,
          precio: resumen ? precioDeLaFila(resumen) : null,
          origen: origenDeFila(f.origin),
          sinAviso: f.status === "AVISO_FALLIDO",
          errorCode: f.errorCode,
        };
      }),
    );
  } catch (e) {
    console.error("[presupuesto-automatico] listarPorAprobar falló", { codigo: (e as { code?: unknown } | null)?.code ?? null });
    return [];
  }
}

/** Cuántas esperan aprobación (para la pestaña). Archiva antes las viejas. 0 si falla. */
export async function contarPorAprobar(workspaceId: string, ahora: Date = new Date()): Promise<number> {
  try {
    await archivarViejas(workspaceId, ahora);
    return await prisma.fotofficePresupuestoAprobacion.count({ where: condicionPorAprobar(workspaceId, ahora) });
  } catch {
    return 0;
  }
}

/** La aprobación pendiente de un presupuesto (o null). Las de más de 14 días no cuentan. */
export async function aprobacionDelPresupuesto(workspaceId: string, presupuestoId: string, ahora: Date = new Date()): Promise<{ id: string } | null> {
  try {
    return await prisma.fotofficePresupuestoAprobacion.findFirst({
      where: { ...condicionPorAprobar(workspaceId, ahora), presupuestoId },
      select: { id: true },
    });
  } catch {
    return null;
  }
}

/** «Aprobar y enviar» desde Presupuestos: el mismo camino que el botón de Telegram. */
export async function aprobarDesdeElPanel(
  ctx: CtxPresupuestos,
  aprobacionId: unknown,
  deps: DepsFlujo = {},
  aprobar: typeof aprobarYEnviar = aprobarYEnviar,
): Promise<ResultadoAprobar | { ok: false; codigo: "SIN_PERMISO" | "DATOS"; texto: string }> {
  if (!puedeGestionarPresupuestos(ctx) || ctx.userId === null) return { ok: false, codigo: "SIN_PERMISO", texto: MENSAJES_POR_APROBAR.sinPermiso };
  if (typeof aprobacionId !== "string" || aprobacionId.length === 0 || aprobacionId.length > 64) {
    return { ok: false, codigo: "DATOS", texto: MENSAJES_POR_APROBAR.datosInvalidos };
  }
  return aprobar(ctx.workspaceId, aprobacionId, { tipo: "PANEL", userId: ctx.userId }, deps);
}

/** «Descartar»: la archiva (sólo si todavía espera aprobación). */
export async function descartarAprobacion(ctx: CtxPresupuestos, aprobacionId: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!puedeGestionarPresupuestos(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_POR_APROBAR.sinPermiso };
  if (typeof aprobacionId !== "string" || aprobacionId.length === 0 || aprobacionId.length > 64) return { ok: false, error: MENSAJES_POR_APROBAR.datosInvalidos };
  const r = await prisma.fotofficePresupuestoAprobacion.updateMany({
    where: { id: aprobacionId, workspaceId: ctx.workspaceId, status: { in: [...ESTADOS_APROBABLES, "SIN_PROPUESTA"] } },
    data: { status: ESTADO_ARCHIVADO, errorCode: "DESCARTADO" },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: MENSAJES_POR_APROBAR.yaNoEspera };
}
