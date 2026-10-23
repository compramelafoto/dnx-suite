import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * La autorización que da la familia al diseño en el canje deja de valer cuando el diseño cambia
 * por algo que la familia no vio: se pasó a otra versión de la plantilla o el fotógrafo retocó el
 * armado a mano.
 *
 * Gancho: la autorización con fecha de la familia todavía no está en la base (la está sumando
 * otro cambio, en el flujo de canje). Cuando llegue, esto la anula y deja anotado el motivo, y
 * devuelve `true` si había una. Mientras tanto no hay nada que anular.
 */
export async function invalidarAutorizacionDeLaFamilia(
  _tx: Prisma.TransactionClient,
  _designProjectId: number,
  _motivo: string,
): Promise<boolean> {
  return false;
}
