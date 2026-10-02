import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { registrarEventoPersona } from "./eventos";
import { duenoDe, wherePersona, type PersonaRef } from "./persona";

export const MAX_CARACTERES_NOTA = 4000;
export const MAX_NOTAS_FIJADAS = 3;
export const ERROR_TRES_FIJADAS = "Ya hay 3 notas fijadas: desfijá una primero.";
export const ERROR_NOTA_NO_ENCONTRADA = "No encontramos esa nota.";

export type CtxNotas = {
  workspaceId: string;
  userId: number;
  userLabel: string;
  role: string | null;
  persona: PersonaRef;
};

export type ResultadoNota = { ok: true } | { ok: false; error: string };

export function validarNota(input: {
  body: unknown;
  categoryId?: unknown;
}): { ok: true; body: string } | { ok: false; error: string } {
  if (typeof input.body !== "string") return { ok: false, error: "Escribí la nota." };
  const body = input.body.trim();
  if (body.length === 0) return { ok: false, error: "Escribí la nota." };
  if (body.length > MAX_CARACTERES_NOTA) return { ok: false, error: "La nota puede tener hasta 4.000 caracteres." };
  const c = input.categoryId;
  if (c !== undefined && c !== null && (typeof c !== "string" || c.length === 0 || c.length > 100)) {
    return { ok: false, error: "Elegí una categoría." };
  }
  return { ok: true, body };
}

/** El autor, o quien puede configurar (Dueño/Administrador). */
export function puedeModificarNota(
  ctx: { role: string | null; userId: number },
  nota: { authorUserId: number | null },
): boolean {
  if (nota.authorUserId !== null && nota.authorUserId === ctx.userId) return true;
  return puede(ctx.role, "configurar");
}

async function categoriaValida(workspaceId: string, categoryId: string): Promise<boolean> {
  const c = await prisma.fotofficeNoteCategory.findFirst({
    where: { id: categoryId, workspaceId, isActive: true },
    select: { id: true },
  });
  return !!c;
}

async function notaDeLaPersona(ctx: CtxNotas, noteId: string) {
  return prisma.fotofficeNote.findFirst({
    where: { id: noteId, deletedAt: null, ...wherePersona(ctx.workspaceId, ctx.persona) },
    select: { id: true, authorUserId: true, categoryId: true, pinned: true },
  });
}

export async function crearNota(
  ctx: CtxNotas,
  input: { body: unknown; categoryId: unknown },
): Promise<ResultadoNota> {
  const v = validarNota(input);
  if (!v.ok) return v;
  if (typeof input.categoryId !== "string" || input.categoryId.length === 0) {
    return { ok: false, error: "Elegí una categoría." };
  }
  if (!(await categoriaValida(ctx.workspaceId, input.categoryId))) return { ok: false, error: "Elegí una categoría." };
  await prisma.fotofficeNote.create({
    data: {
      workspaceId: ctx.workspaceId,
      ...duenoDe(ctx.persona),
      categoryId: input.categoryId,
      body: v.body,
      authorUserId: ctx.userId,
      authorLabel: ctx.userLabel,
    },
  });
  return { ok: true };
}

/** `categoryId` undefined = no tocar la categoría (las notas convertidas no tienen). */
export async function editarNota(
  ctx: CtxNotas,
  noteId: string,
  input: { body: unknown; categoryId?: unknown },
): Promise<ResultadoNota> {
  const nota = await notaDeLaPersona(ctx, noteId);
  if (!nota) return { ok: false, error: ERROR_NOTA_NO_ENCONTRADA };
  if (!puedeModificarNota(ctx, nota)) return { ok: false, error: "Sólo el autor o un administrador pueden editar esta nota." };
  const v = validarNota(input);
  if (!v.ok) return v;
  const data: { body: string; editedAt: Date; categoryId?: string } = { body: v.body, editedAt: new Date() };
  if (typeof input.categoryId === "string") {
    if (!(await categoriaValida(ctx.workspaceId, input.categoryId))) return { ok: false, error: "Elegí una categoría." };
    data.categoryId = input.categoryId;
  }
  await prisma.fotofficeNote.updateMany({ where: { id: nota.id, workspaceId: ctx.workspaceId }, data });
  return { ok: true };
}

/** Borrado blando. El evento no lleva el texto de la nota. */
export async function borrarNota(ctx: CtxNotas, noteId: string): Promise<ResultadoNota> {
  const nota = await notaDeLaPersona(ctx, noteId);
  if (!nota) return { ok: false, error: ERROR_NOTA_NO_ENCONTRADA };
  if (!puedeModificarNota(ctx, nota)) return { ok: false, error: "Sólo el autor o un administrador pueden borrar esta nota." };
  await prisma.$transaction(async (tx) => {
    await tx.fotofficeNote.updateMany({
      where: { id: nota.id, workspaceId: ctx.workspaceId },
      data: { deletedAt: new Date(), pinned: false },
    });
    await registrarEventoPersona(tx, {
      workspaceId: ctx.workspaceId,
      dueno: duenoDe(ctx.persona),
      kind: "NOTA_BORRADA",
      detail: { noteId: nota.id, categoryId: nota.categoryId },
      actor: { userId: ctx.userId, label: ctx.userLabel },
    });
  });
  return { ok: true };
}

/** Fijar/desfijar. Las observaciones convertidas ya vienen fijadas y cuentan para el máximo. */
export async function fijarNota(ctx: CtxNotas, noteId: string, fijar: boolean): Promise<ResultadoNota> {
  const nota = await notaDeLaPersona(ctx, noteId);
  if (!nota) return { ok: false, error: ERROR_NOTA_NO_ENCONTRADA };
  if (fijar && !nota.pinned) {
    const fijadas = await prisma.fotofficeNote.count({
      where: { pinned: true, deletedAt: null, ...wherePersona(ctx.workspaceId, ctx.persona) },
    });
    if (fijadas >= MAX_NOTAS_FIJADAS) return { ok: false, error: ERROR_TRES_FIJADAS };
  }
  await prisma.fotofficeNote.updateMany({
    where: { id: nota.id, workspaceId: ctx.workspaceId },
    data: { pinned: fijar },
  });
  return { ok: true };
}

export async function listarNotas(
  workspaceId: string,
  persona: PersonaRef,
  opts: { antesDe?: Date; take: number },
) {
  return prisma.fotofficeNote.findMany({
    where: {
      deletedAt: null,
      ...wherePersona(workspaceId, persona),
      // Primera página: fijadas + recientes. Las siguientes: sólo no fijadas más viejas que el corte.
      ...(opts.antesDe ? { pinned: false, createdAt: { lt: opts.antesDe } } : {}),
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(1, Math.floor(opts.take)), 100),
    select: {
      id: true,
      body: true,
      pinned: true,
      categoryId: true,
      category: { select: { name: true } },
      authorUserId: true,
      authorLabel: true,
      editedAt: true,
      createdAt: true,
    },
  });
}
