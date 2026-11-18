/**
 * Pagos encadenados de preventa: cuando la familia elige varios packs distintos, la pantalla
 * arma un pedido por pack (cada pedido guarda un solo pack: de eso dependen el canje y el
 * diseño del libro) y los paga uno después del otro. Al volver de Mercado Pago con el primero
 * pagado, la pantalla de pago exitoso le muestra los que le faltan.
 *
 * Los pedidos no quedan atados entre sí en la base: se reconocen por ser del mismo álbum, del
 * mismo email y armados cerca en el tiempo del que se acaba de pagar.
 */

/** Distancia máxima entre el pedido pagado y los otros de la misma compra. */
export const VENTANA_MISMA_COMPRA_MS = 60 * 60 * 1000;

export type PedidoPreventaParaEncadenar = {
  id: number;
  status: string;
  totalCents: number;
  createdAt: Date;
  packDefinitionId: number | null;
  packName: string | null;
};

export type PackPendienteDeLaMismaCompra = {
  orderId: number;
  packName: string;
  /** Pesos enteros (Order.totalCents guarda pesos, no centavos). */
  totalArs: number;
};

/**
 * De todos los pedidos de preventa del mismo comprador en el álbum, deja los que le faltan
 * pagar de la misma compra que `pagado`:
 * - pendientes y armados a menos de una hora del pagado;
 * - nunca un pack que ya tiene pagado (un pendiente viejo del mismo pack haría pagar dos veces);
 * - uno solo por pack: el más nuevo (reintentos dejan varios pendientes iguales).
 */
export function packsPendientesDeLaMismaCompra(
  pagado: PedidoPreventaParaEncadenar,
  pedidosDelComprador: PedidoPreventaParaEncadenar[],
): PackPendienteDeLaMismaCompra[] {
  const packsYaPagados = new Set<number>();
  for (const p of pedidosDelComprador) {
    if (p.status === "PAID" && p.packDefinitionId != null) packsYaPagados.add(p.packDefinitionId);
  }
  if (pagado.packDefinitionId != null) packsYaPagados.add(pagado.packDefinitionId);

  const masNuevoPorPack = new Map<number, PedidoPreventaParaEncadenar>();
  for (const p of pedidosDelComprador) {
    if (p.id === pagado.id) continue;
    if (p.status !== "PENDING") continue;
    if (p.packDefinitionId == null) continue;
    if (packsYaPagados.has(p.packDefinitionId)) continue;
    if (Math.abs(p.createdAt.getTime() - pagado.createdAt.getTime()) > VENTANA_MISMA_COMPRA_MS) continue;
    const previo = masNuevoPorPack.get(p.packDefinitionId);
    if (!previo || p.createdAt.getTime() > previo.createdAt.getTime() || (p.createdAt.getTime() === previo.createdAt.getTime() && p.id > previo.id)) {
      masNuevoPorPack.set(p.packDefinitionId, p);
    }
  }

  return [...masNuevoPorPack.values()]
    .sort((a, b) => a.id - b.id)
    .map((p) => ({
      orderId: p.id,
      packName: (p.packName ?? "").trim() || "Pack",
      totalArs: Math.max(0, Math.round(p.totalCents)),
    }));
}

/** Lee `packDefinitionId` y `packName` del comprobante del pack guardado en el pedido. */
export function packDelComprobante(snapshot: unknown): { packDefinitionId: number | null; packName: string | null } {
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) {
    return { packDefinitionId: null, packName: null };
  }
  const s = snapshot as Record<string, unknown>;
  const id = Number(s.packDefinitionId);
  return {
    packDefinitionId: Number.isInteger(id) && id > 0 ? id : null,
    packName: typeof s.packName === "string" ? s.packName : null,
  };
}
