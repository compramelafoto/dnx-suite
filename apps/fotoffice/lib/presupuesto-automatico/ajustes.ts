import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { MENSAJES_PRESUPUESTO, puedeConfigurarPresupuestos, type CtxPresupuestos } from "@/lib/presupuestos/acceso";
import { MAX_ACUSE, textoDeAcuse } from "./canales";
import { leerAjustesPorHoras } from "./por-horas";
import { aplicarCambio, validarPortfolio, type CambioPortfolio, type ItemPortfolio } from "./portfolio-items";

/**
 * Ajustes del presupuesto automático (spec 2026-10-25 §3): por categoría, el interruptor "Aprobar
 * por Telegram" (apagado por omisión) y el portfolio; por workspace, el acuse por WhatsApp.
 *
 * Leer ante cualquier error (por ejemplo, la tabla todavía no existe) devuelve "apagado" y
 * portfolio vacío. Guardar exige `configurar` en Presupuestos. Nunca loguea datos personales.
 */

export const MENSAJES_AJUSTES_AUTO = {
  sinPermiso: MENSAJES_PRESUPUESTO.sinPermisoAjustes,
  datosInvalidos: MENSAJES_PRESUPUESTO.datosInvalidos,
  categoria: "No encontramos esa categoría.",
  acuse: `El acuse puede tener hasta ${MAX_ACUSE} caracteres.`,
  fallo: "No se pudo guardar. ¿Ya se aplicó el SQL del presupuesto automático?",
} as const;

export type ResultadoAjustesAuto = { ok: true } | { ok: false; error: string };
const no = (error: string): ResultadoAjustesAuto => ({ ok: false, error });

function falla(donde: string, error: unknown): void {
  const codigo = (error as { code?: unknown } | null)?.code;
  if (codigo === "P2021") console.warn(`[presupuesto-automatico] ${donde}: falta aplicar el SQL`);
  else console.error(`[presupuesto-automatico] ${donde} falló`, { codigo: typeof codigo === "string" ? codigo : null });
}

const idValido = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

export type AjustesDeCategoria = { telegram: boolean; portfolio: ItemPortfolio[] };

/**
 * (Sistema) ¿La categoría espera la aprobación por Telegram? Sí si tiene el interruptor encendido o,
 * con el presupuesto por horas encendido (spec 2026-10-28), si no tiene propuesta modelo (se arma
 * por horas). Ante cualquier error, false.
 */
export async function apruebaPorTelegram(workspaceId: string, categoriaId: string | null): Promise<boolean> {
  if (!categoriaId) return false;
  try {
    const f = await prisma.fotofficePresupuestoAutoCategoria.findFirst({
      where: { workspaceId, categoryId: categoriaId, telegramEnabled: true },
      select: { id: true },
    });
    if (f !== null) return true;
    if (!(await leerAjustesPorHoras(workspaceId)).encendido) return false;
    const propuesta = await prisma.fotofficePropuestaModelo.findFirst({ where: { workspaceId, categoryId: categoriaId }, select: { id: true } });
    return propuesta === null;
  } catch (e) {
    falla("apruebaPorTelegram", e);
    return false;
  }
}

/** Los ajustes de todas las categorías del workspace (para la pantalla). null si falta la tabla. */
export async function ajustesPorCategoria(workspaceId: string): Promise<Map<string, AjustesDeCategoria> | null> {
  try {
    const filas = await prisma.fotofficePresupuestoAutoCategoria.findMany({
      where: { workspaceId },
      select: { categoryId: true, telegramEnabled: true, portfolio: true },
      take: 500,
    });
    return new Map(filas.map((f) => [f.categoryId, { telegram: f.telegramEnabled, portfolio: validarPortfolio(workspaceId, f.portfolio) }]));
  } catch (e) {
    falla("ajustesPorCategoria", e);
    return null;
  }
}

/** El portfolio de una categoría (vacío ante cualquier error). */
export async function portfolioDeCategoria(workspaceId: string, categoriaId: string): Promise<ItemPortfolio[]> {
  try {
    const f = await prisma.fotofficePresupuestoAutoCategoria.findFirst({ where: { workspaceId, categoryId: categoriaId }, select: { portfolio: true } });
    return f ? validarPortfolio(workspaceId, f.portfolio) : [];
  } catch (e) {
    falla("portfolioDeCategoria", e);
    return [];
  }
}

async function categoriaDelWorkspace(workspaceId: string, categoriaId: string, soloActiva: boolean): Promise<boolean> {
  const c = await prisma.fotofficeConsultaCategoria.findFirst({
    where: { id: categoriaId, workspaceId, ...(soloActiva ? { archivedAt: null } : {}) },
    select: { id: true },
  });
  return c !== null;
}

async function guardarCategoria(
  ctx: CtxPresupuestos,
  categoriaId: unknown,
  datos: { telegramEnabled?: boolean; portfolio?: ItemPortfolio[] },
  soloActiva: boolean,
): Promise<ResultadoAjustesAuto> {
  if (!puedeConfigurarPresupuestos(ctx)) return no(MENSAJES_AJUSTES_AUTO.sinPermiso);
  if (!idValido(categoriaId)) return no(MENSAJES_AJUSTES_AUTO.datosInvalidos);
  const { workspaceId } = ctx;
  try {
    if (!(await categoriaDelWorkspace(workspaceId, categoriaId, soloActiva))) return no(MENSAJES_AJUSTES_AUTO.categoria);
  } catch (e) {
    falla("guardarCategoria.categoria", e);
    return no(MENSAJES_AJUSTES_AUTO.fallo);
  }
  const data = {
    ...(datos.telegramEnabled !== undefined ? { telegramEnabled: datos.telegramEnabled } : {}),
    ...(datos.portfolio !== undefined ? { portfolio: datos.portfolio as unknown as Prisma.InputJsonValue } : {}),
    updatedByUserId: ctx.userId,
  };
  try {
    await prisma.fotofficePresupuestoAutoCategoria.upsert({
      where: { workspaceId_categoryId: { workspaceId, categoryId: categoriaId } },
      create: { workspaceId, categoryId: categoriaId, ...data },
      update: data,
      select: { id: true },
    });
  } catch (e) {
    // Dos pestañas a la vez: el único frena a una; el resultado es el mismo.
    if ((e as { code?: unknown } | null)?.code === "P2002") return { ok: true };
    falla("guardarCategoria", e);
    return no(MENSAJES_AJUSTES_AUTO.fallo);
  }
  return { ok: true };
}

/** Enciende o apaga "Aprobar por Telegram" en una categoría. Apagar vale también para una archivada. */
export function guardarAprobacionTelegram(ctx: CtxPresupuestos, categoriaId: unknown, encendido: unknown): Promise<ResultadoAjustesAuto> {
  if (typeof encendido !== "boolean") return Promise.resolve(no(MENSAJES_AJUSTES_AUTO.datosInvalidos));
  return guardarCategoria(ctx, categoriaId, { telegramEnabled: encendido }, encendido);
}

/** Guarda el portfolio de una categoría (se valida y se recorta acá: lo que no sirve se descarta). */
export function guardarPortfolio(ctx: CtxPresupuestos, categoriaId: unknown, items: unknown): Promise<ResultadoAjustesAuto> {
  if (!Array.isArray(items)) return Promise.resolve(no(MENSAJES_AJUSTES_AUTO.datosInvalidos));
  return guardarCategoria(ctx, categoriaId, { portfolio: validarPortfolio(ctx.workspaceId, items) }, false);
}

/** Un cambio de la pantalla (agregar, quitar, mover) sobre lo guardado. */
export async function editarPortfolio(ctx: CtxPresupuestos, categoriaId: unknown, cambio: CambioPortfolio): Promise<ResultadoAjustesAuto> {
  if (!idValido(categoriaId)) return no(MENSAJES_AJUSTES_AUTO.datosInvalidos);
  if (!puedeConfigurarPresupuestos(ctx)) return no(MENSAJES_AJUSTES_AUTO.sinPermiso);
  const actuales = await portfolioDeCategoria(ctx.workspaceId, categoriaId);
  return guardarPortfolio(ctx, categoriaId, aplicarCambio(ctx.workspaceId, actuales, cambio));
}

export type Acuse = { encendido: boolean; texto: string; configurado: string | null };

/** El acuse por WhatsApp del workspace. Sin fila (o sin tabla): encendido, con el texto de omisión. */
export async function leerAcuse(workspaceId: string): Promise<Acuse> {
  try {
    const f = await prisma.fotofficePresupuestoAutoAjustes.findUnique({ where: { workspaceId }, select: { acuseEnabled: true, acuseText: true } });
    return { encendido: f?.acuseEnabled ?? true, texto: textoDeAcuse(f?.acuseText), configurado: f?.acuseText ?? null };
  } catch (e) {
    falla("leerAcuse", e);
    return { encendido: true, texto: textoDeAcuse(null), configurado: null };
  }
}

export async function guardarAcuse(ctx: CtxPresupuestos, encendido: unknown, texto: unknown): Promise<ResultadoAjustesAuto> {
  if (!puedeConfigurarPresupuestos(ctx)) return no(MENSAJES_AJUSTES_AUTO.sinPermiso);
  if (typeof encendido !== "boolean" || (texto !== null && typeof texto !== "string")) return no(MENSAJES_AJUSTES_AUTO.datosInvalidos);
  const limpio = typeof texto === "string" ? texto.trim() : "";
  if (limpio.length > MAX_ACUSE) return no(MENSAJES_AJUSTES_AUTO.acuse);
  const data = { acuseEnabled: encendido, acuseText: limpio || null, updatedByUserId: ctx.userId };
  try {
    await prisma.fotofficePresupuestoAutoAjustes.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, ...data },
      update: data,
      select: { id: true },
    });
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002") return { ok: true };
    falla("guardarAcuse", e);
    return no(MENSAJES_AJUSTES_AUTO.fallo);
  }
  return { ok: true };
}
