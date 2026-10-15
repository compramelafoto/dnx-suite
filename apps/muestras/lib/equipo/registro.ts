import "server-only";
import { prisma } from "@repo/db";
import { lastEditText, type EditPart } from "@repo/muestras";

/** Las columnas del último cambio (etapa 5, D8): quién, cuándo y en qué parte. */
export function datosDeCambio(usuarioId: number, parte: EditPart, ahora: Date = new Date()) {
  return { lastEditedByUserId: usuarioId, lastEditedAt: ahora, lastEditedPart: parte };
}

/**
 * Quién hizo un cambio, para los avisos del equipo: sólo el nombre de la cuenta, nunca el email
 * (lo verían otras personas del equipo). Sin nombre, "alguien del equipo". Si no es el dueño ni
 * estuvo en el equipo de esta muestra (por ejemplo, un super admin), "el equipo de Muestras
 * Fotográficas". Cuenta como del equipo aunque ya no esté (el cambio lo hizo cuando estaba).
 */
export async function nombreDeUsuario(id: number, activityId: string): Promise<string> {
  const [u, delEquipo] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { name: true } }),
    prisma.culturalActivity.count({ where: { id: activityId, OR: [{ proposedByUserId: id }, { members: { some: { userId: id } } }] } }),
  ]);
  if (!delEquipo) return "el equipo de Muestras Fotográficas";
  return u?.name?.trim() || "alguien del equipo";
}

/** "Último cambio: Ana Pérez, en los textos, el 14 nov a las 18:40." o `null`. */
export async function textoDelUltimoCambio(a: { id: string; lastEditedByUserId: number | null; lastEditedAt: Date | null; lastEditedPart: string | null }): Promise<string | null> {
  if (a.lastEditedByUserId == null || !a.lastEditedAt) return null;
  return lastEditText({ who: await nombreDeUsuario(a.lastEditedByUserId, a.id), part: a.lastEditedPart, at: a.lastEditedAt });
}
