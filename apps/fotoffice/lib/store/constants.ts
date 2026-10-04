import type { StoreOrderStatus } from "@repo/db";

export const STORE_MODULE_KEY = "store";
export const STORE_EXTERNAL_REFERENCE_PREFIX = "store:";
export const STORE_HOLD_MINUTES = 15;
export const STORE_MAX_PENDING_PER_EMAIL = 3;
/** Cambia cuando cambian los términos que acepta el comprador. */
export const STORE_LEGAL_VERSION = "2026-10-04";
/** Segmento de la tienda bajo `/w/[slug]/`. Es un compromiso público: no cambia. */
export const STORE_PUBLIC_SEGMENT = "tienda";
/**
 * Direcciones fijas bajo `/w/[slug]/tienda/` (el carrito, el checkout, el pedido…). Un producto
 * no puede llamarse así: la ruta fija le ganaría y su ficha quedaría inalcanzable.
 */
export const STORE_RESERVED_SLUGS: readonly string[] = ["carrito", "checkout", "pedido", "arrepentimiento", "terminos"];

export const STORE_ORDER_STATUS_LABELS: Record<StoreOrderStatus, string> = {
  PENDING_PAYMENT: "Esperando el pago",
  PAID: "Pagado — a preparar",
  READY: "Listo para retirar",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido sin pago",
  PAID_NO_STOCK: "Pagado sin stock — resolver",
};

export const DEFAULT_RETURNS_POLICY =
  "Podés arrepentirte de la compra dentro de los 10 días corridos desde que retirás el producto, sin dar explicaciones, usando el botón de arrepentimiento. El producto tiene que estar sin uso y en su empaque. Te devolvemos el dinero por el mismo medio de pago.";
