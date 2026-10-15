/**
 * Claves de sessionStorage del carrito de packs de un álbum (navegador del comprador).
 *
 * El carrito guarda los borradores preparados y, una vez convertido, el id del pedido.
 * Si después de pagar el carrito queda guardado, el comprador vuelve al álbum, ve el
 * mismo pack "preparado" y al tocar Pagar le devolvíamos el link del pedido ya pagado
 * (pedido 4645, 11/10/2026). Por eso la pantalla de pago aprobado lo limpia.
 */

export function albumPackGuestTokenStorageKey(albumId: number): string {
  return `album_${albumId}_pack_selection_guest_token`;
}

export function albumPackDraftStorageKey(albumId: number): string {
  return `album_${albumId}_pack_order_draft_summary`;
}

/** Lee el id de pedido guardado en el carrito de packs (sin validar el resto). */
export function readStoredAlbumPackCartOrderId(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const orderId = Number((parsed as { orderId?: unknown }).orderId);
    return Number.isInteger(orderId) && orderId > 0 ? orderId : null;
  } catch {
    return null;
  }
}

/**
 * Después de un pago aprobado: si el carrito de packs guardado corresponde a ese pedido,
 * se borra (carrito y token de invitado) para que la próxima compra arranque de cero.
 * Devuelve true si limpió algo.
 */
export function clearAlbumPackCartForPaidOrder(
  storage: Pick<Storage, "getItem" | "removeItem">,
  albumId: number,
  paidOrderId: number
): boolean {
  try {
    const storedOrderId = readStoredAlbumPackCartOrderId(
      storage.getItem(albumPackDraftStorageKey(albumId))
    );
    if (storedOrderId == null || storedOrderId !== paidOrderId) return false;
    storage.removeItem(albumPackDraftStorageKey(albumId));
    storage.removeItem(albumPackGuestTokenStorageKey(albumId));
    return true;
  } catch {
    return false;
  }
}
