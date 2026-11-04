/**
 * Preventas compradas, tal como las ve la familia en su panel (/cliente/dashboard).
 *
 * Un pack de preventa es un `Order` con origen PREVENTA_PACK y sin fotos todavía: hasta que el
 * fotógrafo sube el material no tiene ítems. El panel sólo listaba pedidos con fotos digitales,
 * así que la preventa quedaba invisible y la familia sólo podía llegar con el link del correo.
 */

export type ClientPreventaPackRow = {
  orderId: number;
  orderCreatedAt: string;
  albumTitle: string;
  packName: string;
  totalArs: number;
  photographerName: string | null;
  redeemed: boolean;
  href: string;
};

export type PreventaPackOrderForPanel = {
  id: number;
  origin: string;
  status: string;
  createdAt: Date;
  totalCents: number;
  redemptionOrderId: number | null;
  preventaPackSnapshotJson: unknown;
  album: {
    title: string;
    user: { name: string | null; email: string | null };
  };
};

function packNameFromSnapshot(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const name = (raw as { packName?: unknown }).packName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/** Sólo los packs pagados: los pendientes o cancelados no le sirven de nada a la familia. */
export function buildClientPreventaPackRows(
  orders: PreventaPackOrderForPanel[]
): ClientPreventaPackRow[] {
  return orders
    .filter((o) => o.origin === "PREVENTA_PACK" && o.status === "PAID")
    .map((o) => ({
      orderId: o.id,
      orderCreatedAt: o.createdAt.toISOString(),
      albumTitle: o.album.title,
      packName: packNameFromSnapshot(o.preventaPackSnapshotJson) ?? "Pack de preventa",
      // totalCents en CLF guarda pesos, no centavos.
      totalArs: o.totalCents,
      photographerName: o.album.user.name?.trim() || o.album.user.email?.trim() || null,
      redeemed: o.redemptionOrderId != null,
      href: `/cliente/pack/${o.id}`,
    }));
}
