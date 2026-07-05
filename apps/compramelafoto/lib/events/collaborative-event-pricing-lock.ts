import { prisma } from "@/lib/prisma";
import { EventPhotoPricingMode } from "@/lib/prisma";

/** Mensaje unificado cuando el fotógrafo no puede editar política digital (precio/packs digitales propios). */
export const MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING =
  "Este evento usa precios digitales oficiales definidos por el organizador. No podés modificar el precio digital de este álbum ni crear ni editar packs digitales desde acá; las ventas digitales siguen la regla del evento para pedidos nuevos. Sí podés seguir usando impresiones y productos físicos como hasta ahora.";

export type CollaborativeEventPricingLockSnapshot = {
  photoPricingMode: EventPhotoPricingMode;
  fixedPhotoPrice: number | null;
  minimumPhotoPrice: number | null;
  /** True si el organizador fija venta digital (precio individual oficial en evento). */
  locksPhotographerDigitalPricing: boolean;
};

/** A partir de filas Event con modo + montos (sin segundo query cuando ya tenés los campos). */
export function collaborativeEventPricingFromPricingRow(row: {
  photoPricingMode: EventPhotoPricingMode;
  fixedPhotoPrice: number | null;
  minimumPhotoPrice: number | null;
}): CollaborativeEventPricingLockSnapshot {
  return {
    photoPricingMode: row.photoPricingMode,
    fixedPhotoPrice: row.fixedPhotoPrice,
    minimumPhotoPrice: row.minimumPhotoPrice,
    locksPhotographerDigitalPricing:
      row.photoPricingMode === EventPhotoPricingMode.ORGANIZER_FIXED,
  };
}

/** Devuelve `null` si no hay evento válido cargado para el álbum. */
export async function loadCollaborativeEventPricingSnapshot(
  eventId: number | null | undefined
): Promise<CollaborativeEventPricingLockSnapshot | null> {
  if (eventId == null || !(Number.isFinite(eventId) && eventId > 0)) {
    return null;
  }
  const row = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      photoPricingMode: true,
      fixedPhotoPrice: true,
      minimumPhotoPrice: true,
    },
  });
  if (!row) return null;
  return collaborativeEventPricingFromPricingRow(row);
}
