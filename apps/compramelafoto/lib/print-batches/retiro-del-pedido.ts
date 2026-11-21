import "server-only";
import { prisma } from "@/lib/prisma";
import { contactoDeRetiro } from "./puntos-de-retiro";

/**
 * Dónde retira el cliente un pedido de un lote, leído de la base. La regla (elegido activo y punto de
 * retiro, si no el predeterminado activo, si no null) vive en `contactoDeRetiro`; acá sólo se traen
 * los contactos activos del fotógrafo con lo que hace falta para el correo y el sobre.
 */

export const SELECT_CONTACTO_DE_RETIRO = {
  id: true,
  nombre: true,
  activo: true,
  puntoDeRetiro: true,
  esPredeterminado: true,
  direccion: true,
  horario: true,
  lab: { select: { name: true, address: true, city: true } },
} as const;

export function contactosActivosDelFotografo(photographerId: number) {
  return prisma.photographerLabContact.findMany({ where: { photographerId, activo: true }, select: SELECT_CONTACTO_DE_RETIRO });
}

export type ContactoDeRetiro = Awaited<ReturnType<typeof contactosActivosDelFotografo>>[number];

export async function contactoDeRetiroDelPedido(
  photographerId: number,
  elegidoId: number | null,
  labDelLoteId?: number | null,
): Promise<ContactoDeRetiro | null> {
  return contactoDeRetiro(elegidoId, await contactosActivosDelFotografo(photographerId), labDelLoteId);
}
