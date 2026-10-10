import "server-only";
import { prisma } from "@repo/db";
import { lastEditText, type EditPart } from "@repo/muestras";

/** Las columnas del último cambio (etapa 5, D8): quién, cuándo y en qué parte. */
export function datosDeCambio(usuarioId: number, parte: EditPart, ahora: Date = new Date()) {
  return { lastEditedByUserId: usuarioId, lastEditedAt: ahora, lastEditedPart: parte };
}

/** Nombre (o email) de una persona, para los avisos del equipo. */
export async function nombreDeUsuario(id: number): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
  return u?.name?.trim() || u?.email || null;
}

/** "Último cambio: Ana Pérez, en los textos, el 14 nov a las 18:40." o `null`. */
export async function textoDelUltimoCambio(a: { lastEditedByUserId: number | null; lastEditedAt: Date | null; lastEditedPart: string | null }): Promise<string | null> {
  if (a.lastEditedByUserId == null || !a.lastEditedAt) return null;
  return lastEditText({ who: await nombreDeUsuario(a.lastEditedByUserId), part: a.lastEditedPart, at: a.lastEditedAt });
}
