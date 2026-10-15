/**
 * ¿Se le puede dar un link de pago a este pedido de pack?
 *
 * Un pedido que ya está pagado (o cerrado por otro motivo) nunca tiene que devolver
 * el link de Mercado Pago guardado: el comprador lo volvería a pagar y Mercado Pago
 * lo acepta (pasó con el pedido 4645, pagado dos veces el 11/10/2026).
 *
 * Funciones puras (sin base) para poder probarlas solas.
 */

export const ALBUM_PACK_ORDER_ALREADY_PAID_CODE = "ORDER_ALREADY_PAID";
export const ALBUM_PACK_ORDER_NOT_PAYABLE_CODE = "ORDER_NOT_PAYABLE";

export const ALBUM_PACK_ORDER_ALREADY_PAID_MESSAGE =
  "Este pack ya está pagado. Para comprar otras fotos iniciá una compra nueva.";

export type AlbumPackOrderPayableCheck =
  | { ok: true }
  | { ok: false; code: string; error: string; httpStatus: number };

/**
 * Sólo un pedido PENDING puede recibir (o reusar) un link de pago.
 * PAID → ORDER_ALREADY_PAID (409). Cualquier otro estado → ORDER_NOT_PAYABLE (409).
 */
export function checkAlbumPackOrderPayable(status: string | null | undefined): AlbumPackOrderPayableCheck {
  if (status === "PENDING") return { ok: true };
  if (status === "PAID") {
    return {
      ok: false,
      code: ALBUM_PACK_ORDER_ALREADY_PAID_CODE,
      error: ALBUM_PACK_ORDER_ALREADY_PAID_MESSAGE,
      httpStatus: 409,
    };
  }
  return {
    ok: false,
    code: ALBUM_PACK_ORDER_NOT_PAYABLE_CODE,
    error: "Este pedido ya no se puede pagar. Iniciá una compra nueva.",
    httpStatus: 409,
  };
}

/**
 * Al convertir un borrador en pedido se reusa el pedido que ya existe para ese borrador.
 * Si ese pedido ya está pagado, no se reusa: el borrador quedó consumido y el comprador
 * tiene que armar una selección nueva.
 */
export function isAlbumPackDraftOrderConsumed(status: string | null | undefined): boolean {
  return status === "PAID";
}
