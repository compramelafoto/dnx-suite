import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { MENSAJES_PROYECTO, puedeGestionarProyectos, puedeVerProyectos, type CtxProyectos } from "./acceso";

/** Notas de un proyecto (Etapa 4, Entrega A). Cuerpo de 1 a 5000 caracteres. */

export const NOTA_MAXIMA = 5000;

export type NotaVisible = { id: string; body: string; authorUserId: number | null; createdAt: Date; updatedAt: Date };
export type ResultadoNota = { ok: true; id: string } | { ok: false; error: string };

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function cuerpo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= NOTA_MAXIMA ? t : null;
}

/** Las notas del proyecto, la más nueva primero. */
export async function listarNotas(ctx: CtxProyectos, proyectoId: string): Promise<NotaVisible[]> {
  if (!puedeVerProyectos(ctx) || !idValido(proyectoId)) return [];
  const filas = await prisma.fotofficeProyectoNota.findMany({
    where: { workspaceId: ctx.workspaceId, proyectoId },
    select: { id: true, body: true, authorUserId: true, createdAt: true, updatedAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
  });
  return filas as NotaVisible[];
}

export async function agregarNota(ctx: CtxProyectos, proyectoId: unknown, texto: unknown): Promise<ResultadoNota> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const body = cuerpo(texto);
  if (body === null) return { ok: false, error: MENSAJES_PROYECTO.notaTexto };
  try {
    const p = await prisma.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!p) return { ok: false, error: MENSAJES_PROYECTO.noExiste };
    const fila = await prisma.fotofficeProyectoNota.create({
      data: { workspaceId: ctx.workspaceId, proyectoId: p.id as string, body, authorUserId: ctx.userId },
      select: { id: true },
    });
    return { ok: true, id: fila.id as string };
  } catch {
    return { ok: false, error: MENSAJES_PROYECTO.guardar };
  }
}

/** Una nota la cambia o la borra quien la escribió o quien puede configurar el workspace. */
async function notaPropia(ctx: CtxProyectos, id: string) {
  const n = await prisma.fotofficeProyectoNota.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true, authorUserId: true } });
  if (!n) return { error: MENSAJES_PROYECTO.notaNoExiste } as const;
  if (n.authorUserId !== ctx.userId && !puedeEnContexto(ctx, "configurar")) return { error: MENSAJES_PROYECTO.notaAjena } as const;
  return { id: n.id as string } as const;
}

export async function editarNota(ctx: CtxProyectos, notaId: unknown, texto: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(notaId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const body = cuerpo(texto);
  if (body === null) return { ok: false, error: MENSAJES_PROYECTO.notaTexto };
  try {
    const n = await notaPropia(ctx, notaId);
    if (!("id" in n)) return { ok: false, error: n.error };
    await prisma.fotofficeProyectoNota.updateMany({ where: { id: n.id, workspaceId: ctx.workspaceId }, data: { body } });
    return { ok: true };
  } catch {
    return { ok: false, error: MENSAJES_PROYECTO.guardar };
  }
}

export async function borrarNota(ctx: CtxProyectos, notaId: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(notaId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  try {
    const n = await notaPropia(ctx, notaId);
    if (!("id" in n)) return { ok: false, error: n.error };
    await prisma.fotofficeProyectoNota.deleteMany({ where: { id: n.id, workspaceId: ctx.workspaceId } });
    return { ok: true };
  } catch {
    return { ok: false, error: MENSAJES_PROYECTO.guardar };
  }
}
