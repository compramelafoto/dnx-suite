import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { esSlugDnx } from "@/lib/slug-dnx";

/** Categorías de notas de DNX Estudio, en este orden. */
export const CATEGORIAS_DNX: readonly string[] = [
  "URGENTE",
  "Coordinación",
  "Correcciones",
  "Hacer contrato",
  "Contacto por Teléfono",
  "Correo",
  "Presupuesto",
  "Visita",
  "Recordatorio",
  "Envío de Material",
  "Revisión",
  "Selección de Pruebas",
  "Otro",
];

const CATEGORIAS_GENERAL: readonly string[] = ["General"];

export function categoriasIniciales(slug: string): readonly string[] {
  return esSlugDnx(slug) ? CATEGORIAS_DNX : CATEGORIAS_GENERAL;
}

/**
 * Crea las categorías iniciales sólo si el workspace no tiene ninguna. Dos pedidos a la vez
 * pueden chocar contra el único (workspaceId, name): con `skipDuplicates` el segundo no falla.
 */
export async function asegurarCategorias(workspaceId: string, slug: string): Promise<void> {
  const hay = await prisma.fotofficeNoteCategory.count({ where: { workspaceId } });
  if (hay > 0) return;
  await prisma.fotofficeNoteCategory.createMany({
    data: categoriasIniciales(slug).map((name, order) => ({ workspaceId, name, order })),
    skipDuplicates: true,
  });
}

export async function listarCategorias(workspaceId: string): Promise<{ id: string; name: string }[]> {
  return prisma.fotofficeNoteCategory.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

// ─── Catálogo (requiere `configurar`) ────────────────────────────────────────

export const MAX_NOMBRE_CATEGORIA = 40;
export const ERROR_ULTIMA_CATEGORIA = "Tiene que quedar al menos una categoría activa para poder escribir notas.";
const SIN_PERMISO = "Sólo un administrador puede modificar las categorías de notas.";
const NO_ENCONTRADA = "No encontramos esa categoría.";
const REPETIDA = "Ya existe una categoría con ese nombre.";
const NOMBRE_INVALIDO = "Escribí un nombre de hasta 40 caracteres.";

export type CtxCategorias = { workspaceId: string; role: string | null };
export type ResultadoCategoria = { ok: true } | { ok: false; error: string };
export type CategoriaDelCatalogo = { id: string; name: string; isActive: boolean; notas: number };

/** Nombre limpio (espacios colapsados) o null si está vacío o pasa de 40. */
export function validarNombreCategoria(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const limpio = raw.replace(/\s+/g, " ").trim();
  if (limpio.length < 1 || limpio.length > MAX_NOMBRE_CATEGORIA) return null;
  return limpio;
}

function esChoque(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

const ORDEN = [{ order: "asc" as const }, { name: "asc" as const }, { id: "asc" as const }];

/** Todas, activas primero y en su orden; las desactivadas después. Con cuántas notas usan cada una. */
export async function listarCatalogoDeCategorias(workspaceId: string): Promise<CategoriaDelCatalogo[]> {
  const filas = await prisma.fotofficeNoteCategory.findMany({
    where: { workspaceId },
    orderBy: [{ isActive: "desc" }, ...ORDEN],
    select: { id: true, name: true, isActive: true, _count: { select: { notes: { where: { deletedAt: null } } } } },
  });
  return filas.map((f) => ({ id: f.id, name: f.name, isActive: f.isActive, notas: f._count.notes }));
}

async function otraConElNombre(workspaceId: string, nombre: string, salvo?: string) {
  return prisma.fotofficeNoteCategory.findFirst({
    where: { workspaceId, name: { equals: nombre, mode: "insensitive" }, ...(salvo ? { NOT: { id: salvo } } : {}) },
    select: { id: true, isActive: true },
  });
}

/** Alta al final de la lista. Si existía desactivada con ese nombre, vuelve a activarse. */
export async function crearCategoria(ctx: CtxCategorias, nombre: unknown): Promise<ResultadoCategoria> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: SIN_PERMISO };
  const name = validarNombreCategoria(nombre);
  if (!name) return { ok: false, error: NOMBRE_INVALIDO };
  const ya = await otraConElNombre(ctx.workspaceId, name);
  const ultima = await prisma.fotofficeNoteCategory.findFirst({
    where: { workspaceId: ctx.workspaceId, isActive: true },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (ultima?.order ?? -1) + 1;
  if (ya) {
    if (ya.isActive) return { ok: false, error: REPETIDA };
    await prisma.fotofficeNoteCategory.updateMany({
      where: { id: ya.id, workspaceId: ctx.workspaceId },
      data: { isActive: true, order },
    });
    return { ok: true };
  }
  try {
    await prisma.fotofficeNoteCategory.create({ data: { workspaceId: ctx.workspaceId, name, order } });
  } catch (e) {
    if (esChoque(e)) return { ok: false, error: REPETIDA };
    throw e;
  }
  return { ok: true };
}

export async function renombrarCategoria(ctx: CtxCategorias, id: string, nombre: unknown): Promise<ResultadoCategoria> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: SIN_PERMISO };
  const name = validarNombreCategoria(nombre);
  if (!name) return { ok: false, error: NOMBRE_INVALIDO };
  if (await otraConElNombre(ctx.workspaceId, name, id)) return { ok: false, error: REPETIDA };
  try {
    const r = await prisma.fotofficeNoteCategory.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: { name } });
    return r.count === 0 ? { ok: false, error: NO_ENCONTRADA } : { ok: true };
  } catch (e) {
    if (esChoque(e)) return { ok: false, error: REPETIDA };
    throw e;
  }
}

/**
 * Sube o baja una categoría activa un lugar. Renumera todas las activas (0, 1, 2…) para que
 * un orden repetido de antes no deje el botón sin efecto.
 */
export async function moverCategoria(ctx: CtxCategorias, id: string, hacia: "subir" | "bajar"): Promise<ResultadoCategoria> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: SIN_PERMISO };
  if (hacia !== "subir" && hacia !== "bajar") return { ok: false, error: NO_ENCONTRADA };
  return prisma.$transaction(async (tx) => {
    const activas = await tx.fotofficeNoteCategory.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      orderBy: ORDEN,
      select: { id: true },
    });
    const i = activas.findIndex((c) => c.id === id);
    if (i < 0) return { ok: false as const, error: NO_ENCONTRADA };
    const j = hacia === "subir" ? i - 1 : i + 1;
    if (j < 0 || j >= activas.length) return { ok: true as const };
    const ids = activas.map((c) => c.id);
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    for (const [order, cid] of ids.entries()) {
      await tx.fotofficeNoteCategory.updateMany({ where: { id: cid, workspaceId: ctx.workspaceId }, data: { order } });
    }
    return { ok: true as const };
  });
}

/**
 * Deja de ofrecerse para notas nuevas; las notas que ya la usan la conservan. No se puede
 * desactivar la última activa: sin categorías no se podría escribir ninguna nota.
 */
export async function desactivarCategoria(ctx: CtxCategorias, id: string): Promise<ResultadoCategoria> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: SIN_PERMISO };
  const cat = await prisma.fotofficeNoteCategory.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, isActive: true },
  });
  if (!cat) return { ok: false, error: NO_ENCONTRADA };
  if (!cat.isActive) return { ok: true };
  const activas = await prisma.fotofficeNoteCategory.count({ where: { workspaceId: ctx.workspaceId, isActive: true } });
  if (activas <= 1) return { ok: false, error: ERROR_ULTIMA_CATEGORIA };
  await prisma.fotofficeNoteCategory.updateMany({ where: { id: cat.id, workspaceId: ctx.workspaceId }, data: { isActive: false } });
  return { ok: true };
}

/** Vuelve a ofrecerla, al final de la lista. */
export async function activarCategoria(ctx: CtxCategorias, id: string): Promise<ResultadoCategoria> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: SIN_PERMISO };
  const ultima = await prisma.fotofficeNoteCategory.findFirst({
    where: { workspaceId: ctx.workspaceId, isActive: true },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const r = await prisma.fotofficeNoteCategory.updateMany({
    where: { id, workspaceId: ctx.workspaceId, isActive: false },
    data: { isActive: true, order: (ultima?.order ?? -1) + 1 },
  });
  return r.count === 0 ? { ok: false, error: NO_ENCONTRADA } : { ok: true };
}
