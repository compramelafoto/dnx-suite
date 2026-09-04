import { OrderOrigin } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

/**
 * Reconstruye, desde el pedido de canje ya guardado, qué fotos eligió la familia para cada
 * beneficio del pack.
 *
 * El canje deja ese vínculo en `OrderItem.benefitStableKey`, así que el dato sobrevive a la sesión.
 * Sirve para regenerar un diseño más tarde sin repetir el error de armar la carpeta impresa con las
 * fotos que se habían elegido para descargar.
 *
 * Devuelve `null` cuando no hay pedido de canje o sus ítems no tienen el vínculo (pedidos viejos):
 * en ese caso el motor de diseño mantiene el comportamiento anterior.
 */
export async function loadPhotoIdsByBenefitKeyForPreventaOrder(
  preventaOrderId: number
): Promise<Map<string, number[]> | null> {
  if (!Number.isFinite(preventaOrderId) || preventaOrderId <= 0) return null;

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        redeemsOrderId: preventaOrderId,
        origin: OrderOrigin.PACK_REDEMPTION,
      },
      benefitStableKey: { not: null },
    },
    select: { id: true, benefitStableKey: true, photoId: true, packSlotIndex: true },
    orderBy: [{ packSlotIndex: "asc" }, { id: "asc" }],
  });

  if (items.length === 0) return null;

  const porBeneficio = new Map<string, number[]>();
  for (const item of items) {
    if (item.benefitStableKey == null) continue;
    const lista = porBeneficio.get(item.benefitStableKey) ?? [];
    lista.push(item.photoId);
    porBeneficio.set(item.benefitStableKey, lista);
  }

  return porBeneficio.size > 0 ? porBeneficio : null;
}
