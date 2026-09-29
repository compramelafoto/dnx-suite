import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { registrarEventoPersona } from "./eventos";
import { duenoDe, wherePersona, type PersonaRef } from "./persona";

export const COLORES_ETIQUETA = ["gris", "rojo", "naranja", "amarillo", "verde", "azul", "violeta", "rosa"] as const;
export type ColorEtiqueta = (typeof COLORES_ETIQUETA)[number];

export const MAX_NOMBRE_ETIQUETA = 40;

export type CtxEtiquetas = {
  workspaceId: string;
  userId: number;
  userLabel: string;
  role: string | null;
};
export type ResultadoEtiqueta = { ok: true } | { ok: false; error: string };

const ETIQUETA_NO_ENCONTRADA = "No encontramos esa etiqueta.";
const NOMBRE_REPETIDO = "Ya existe una etiqueta con ese nombre.";
const SIN_PERMISO = "Sólo un administrador puede modificar el catálogo de etiquetas.";

/** Minúsculas, sin acentos y con los espacios colapsados: decide si dos nombres son el mismo. */
export function claveDeEtiqueta(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Nombre limpio (espacios colapsados) o null si no sirve (vacío o de más de 40). */
export function validarNombreEtiqueta(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const limpio = raw.replace(/\s+/g, " ").trim();
  if (limpio.length < 1 || limpio.length > MAX_NOMBRE_ETIQUETA) return null;
  return limpio;
}

export function esColorEtiqueta(v: unknown): v is ColorEtiqueta {
  return typeof v === "string" && (COLORES_ETIQUETA as readonly string[]).includes(v);
}

function esChoque(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

export async function buscarEtiquetas(workspaceId: string, texto: string, take = 10) {
  const clave = claveDeEtiqueta(texto);
  return prisma.fotofficeTag.findMany({
    where: { workspaceId, ...(clave ? { nameKey: { contains: clave } } : {}) },
    orderBy: { nameKey: "asc" },
    take: Math.min(Math.max(1, Math.floor(take)), 50),
    select: { id: true, name: true, color: true },
  });
}

/** Las etiquetas de la persona, de los dos lados del vínculo y sin repetir. */
export async function etiquetasDePersona(workspaceId: string, persona: PersonaRef) {
  const filas = await prisma.fotofficeTagAssignment.findMany({
    where: wherePersona(workspaceId, persona),
    orderBy: { createdAt: "asc" },
    select: { tag: { select: { id: true, name: true, color: true } } },
  });
  const vistas = new Map<string, { id: string; name: string; color: string }>();
  for (const f of filas) if (!vistas.has(f.tag.id)) vistas.set(f.tag.id, f.tag);
  return [...vistas.values()];
}

/** Busca la etiqueta por id, o por nombre (creándola si no existe). Siempre dentro del workspace. */
async function resolverEtiqueta(
  workspaceId: string,
  ref: { tagId: string } | { nombre: string },
): Promise<{ id: string; name: string } | null> {
  if ("tagId" in ref) {
    if (typeof ref.tagId !== "string" || !ref.tagId) return null;
    return prisma.fotofficeTag.findFirst({ where: { id: ref.tagId, workspaceId }, select: { id: true, name: true } });
  }
  const nombre = validarNombreEtiqueta(ref.nombre);
  if (!nombre) return null;
  const nameKey = claveDeEtiqueta(nombre);
  const existente = await prisma.fotofficeTag.findFirst({
    where: { workspaceId, nameKey },
    select: { id: true, name: true },
  });
  if (existente) return existente;
  try {
    return await prisma.fotofficeTag.create({
      data: { workspaceId, name: nombre, nameKey },
      select: { id: true, name: true },
    });
  } catch (e) {
    if (!esChoque(e)) throw e;
    return prisma.fotofficeTag.findFirst({ where: { workspaceId, nameKey }, select: { id: true, name: true } });
  }
}

export async function ponerEtiqueta(
  ctx: CtxEtiquetas,
  persona: PersonaRef,
  ref: { tagId: string } | { nombre: string },
): Promise<ResultadoEtiqueta> {
  const tag = await resolverEtiqueta(ctx.workspaceId, ref);
  if (!tag) {
    return { ok: false, error: "nombre" in ref ? "Escribí un nombre de hasta 40 caracteres." : ETIQUETA_NO_ENCONTRADA };
  }
  const ya = await prisma.fotofficeTagAssignment.findFirst({
    where: { tagId: tag.id, ...wherePersona(ctx.workspaceId, persona) },
    select: { id: true },
  });
  if (ya) return { ok: true };
  const dueno = duenoDe(persona);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.fotofficeTagAssignment.create({
        data: { workspaceId: ctx.workspaceId, tagId: tag.id, ...dueno, createdByUserId: ctx.userId },
      });
      await registrarEventoPersona(tx, {
        workspaceId: ctx.workspaceId,
        dueno,
        kind: "ETIQUETA_PUESTA",
        detail: { tagId: tag.id, nombre: tag.name },
        actor: { userId: ctx.userId, label: ctx.userLabel },
      });
    });
  } catch (e) {
    // Otra pestaña la puso en el mismo instante: el índice único parcial nos frena; da igual.
    if (!esChoque(e)) throw e;
  }
  return { ok: true };
}

export async function quitarEtiqueta(ctx: CtxEtiquetas, persona: PersonaRef, tagId: string): Promise<ResultadoEtiqueta> {
  if (typeof tagId !== "string" || !tagId) return { ok: false, error: ETIQUETA_NO_ENCONTRADA };
  const tag = await prisma.fotofficeTag.findFirst({
    where: { id: tagId, workspaceId: ctx.workspaceId },
    select: { id: true, name: true },
  });
  if (!tag) return { ok: false, error: ETIQUETA_NO_ENCONTRADA };
  await prisma.$transaction(async (tx) => {
    const r = await tx.fotofficeTagAssignment.deleteMany({
      where: { tagId: tag.id, ...wherePersona(ctx.workspaceId, persona) },
    });
    if (r.count === 0) return;
    await registrarEventoPersona(tx, {
      workspaceId: ctx.workspaceId,
      dueno: duenoDe(persona),
      kind: "ETIQUETA_QUITADA",
      detail: { tagId: tag.id, nombre: tag.name },
      actor: { userId: ctx.userId, label: ctx.userLabel },
    });
  });
  return { ok: true };
}

// ─── Catálogo (requiere `configurar`) ────────────────────────────────────────

export async function renombrarEtiqueta(ctx: CtxEtiquetas, tagId: string, nuevo: unknown): Promise<ResultadoEtiqueta> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: SIN_PERMISO };
  const nombre = validarNombreEtiqueta(nuevo);
  if (!nombre) return { ok: false, error: "Escribí un nombre de hasta 40 caracteres." };
  const nameKey = claveDeEtiqueta(nombre);
  const tag = await prisma.fotofficeTag.findFirst({ where: { id: tagId, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!tag) return { ok: false, error: ETIQUETA_NO_ENCONTRADA };
  const otra = await prisma.fotofficeTag.findFirst({
    where: { workspaceId: ctx.workspaceId, nameKey, NOT: { id: tag.id } },
    select: { id: true },
  });
  if (otra) return { ok: false, error: NOMBRE_REPETIDO };
  try {
    await prisma.fotofficeTag.updateMany({ where: { id: tag.id, workspaceId: ctx.workspaceId }, data: { name: nombre, nameKey } });
  } catch (e) {
    if (esChoque(e)) return { ok: false, error: NOMBRE_REPETIDO };
    throw e;
  }
  return { ok: true };
}

export async function cambiarColor(ctx: CtxEtiquetas, tagId: string, color: unknown): Promise<ResultadoEtiqueta> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: SIN_PERMISO };
  if (!esColorEtiqueta(color)) return { ok: false, error: "Elegí un color de la paleta." };
  const r = await prisma.fotofficeTag.updateMany({ where: { id: tagId, workspaceId: ctx.workspaceId }, data: { color } });
  return r.count === 0 ? { ok: false, error: ETIQUETA_NO_ENCONTRADA } : { ok: true };
}

/** Pasa las personas de `origen` a `destino` sin duplicar y borra `origen`. */
export async function unirEtiquetas(ctx: CtxEtiquetas, origenId: string, destinoId: string): Promise<ResultadoEtiqueta> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: SIN_PERMISO };
  if (origenId === destinoId) return { ok: false, error: "Elegí dos etiquetas distintas." };
  const tags = await prisma.fotofficeTag.findMany({
    where: { workspaceId: ctx.workspaceId, id: { in: [origenId, destinoId] } },
    select: { id: true },
  });
  if (tags.length !== 2) return { ok: false, error: ETIQUETA_NO_ENCONTRADA };
  await prisma.$transaction(async (tx) => {
    const clave = (a: { clientId: string | null; memberId: string | null }) => (a.clientId ? `c:${a.clientId}` : `m:${a.memberId}`);
    const delDestino = await tx.fotofficeTagAssignment.findMany({
      where: { workspaceId: ctx.workspaceId, tagId: destinoId },
      select: { clientId: true, memberId: true },
    });
    const yaTienen = new Set(delDestino.map(clave));
    const delOrigen = await tx.fotofficeTagAssignment.findMany({
      where: { workspaceId: ctx.workspaceId, tagId: origenId },
      select: { id: true, clientId: true, memberId: true },
    });
    const aMover = delOrigen.filter((a) => !yaTienen.has(clave(a))).map((a) => a.id);
    if (aMover.length > 0) {
      await tx.fotofficeTagAssignment.updateMany({
        where: { id: { in: aMover }, workspaceId: ctx.workspaceId },
        data: { tagId: destinoId },
      });
    }
    // Las que quedaron (repetidas) se van con el origen por la cascada.
    await tx.fotofficeTag.deleteMany({ where: { id: origenId, workspaceId: ctx.workspaceId } });
  });
  return { ok: true };
}

/** Borra la etiqueta y deja un evento ETIQUETA_QUITADA por cada persona que la tenía. */
export async function borrarEtiqueta(ctx: CtxEtiquetas, tagId: string): Promise<ResultadoEtiqueta> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: SIN_PERMISO };
  const tag = await prisma.fotofficeTag.findFirst({
    where: { id: tagId, workspaceId: ctx.workspaceId },
    select: { id: true, name: true },
  });
  if (!tag) return { ok: false, error: ETIQUETA_NO_ENCONTRADA };
  await prisma.$transaction(async (tx) => {
    const personas = await tx.fotofficeTagAssignment.findMany({
      where: { workspaceId: ctx.workspaceId, tagId: tag.id },
      select: { clientId: true, memberId: true },
    });
    if (personas.length > 0) {
      await tx.fotofficePersonEvent.createMany({
        data: personas.map((p) => ({
          workspaceId: ctx.workspaceId,
          clientId: p.clientId,
          memberId: p.clientId ? null : p.memberId,
          kind: "ETIQUETA_QUITADA",
          detail: { tagId: tag.id, nombre: tag.name, porBorradoDeEtiqueta: true },
          actorUserId: ctx.userId,
          actorLabel: ctx.userLabel,
        })),
      });
    }
    await tx.fotofficeTag.deleteMany({ where: { id: tag.id, workspaceId: ctx.workspaceId } });
  });
  return { ok: true };
}

export type EtiquetaDelCatalogo = { id: string; name: string; color: string; personas: number };

/** Todo el catálogo, por nombre, con a cuántas personas está puesta cada etiqueta. */
export async function listarCatalogoDeEtiquetas(workspaceId: string): Promise<EtiquetaDelCatalogo[]> {
  const filas = await prisma.fotofficeTag.findMany({
    where: { workspaceId },
    orderBy: { nameKey: "asc" },
    take: 1000,
    select: { id: true, name: true, color: true, _count: { select: { assignments: true } } },
  });
  return filas.map((f) => ({ id: f.id, name: f.name, color: f.color, personas: f._count.assignments }));
}
