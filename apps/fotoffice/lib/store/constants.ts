import type { StoreOrderStatus } from "@repo/db";

export const STORE_MODULE_KEY = "store";
export const STORE_EXTERNAL_REFERENCE_PREFIX = "store:";
export const STORE_HOLD_MINUTES = 15;
export const STORE_MAX_PENDING_PER_EMAIL = 3;
/** Cambia cuando cambian los términos que acepta el comprador. */
export const STORE_LEGAL_VERSION = "2026-10-05";
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
  SHIPPED: "Despachado",
};

/**
 * Comienzos de las notas que deja el sistema en el historial de un pedido cuando algo con la
 * plata necesita que una persona lo mire. El panel las usa para la pestaña "Problemas": quien
 * escribe la nota y quien la busca leen la misma constante.
 */
export const STORE_NOTE_AMOUNT_MISMATCH = "Pago con monto distinto: revisar";
export const STORE_NOTE_DUPLICATE_PREFIX = "Pago duplicado";
export const STORE_NOTE_CREDIT_FAILURE_PREFIX = "Pago aprobado que no se pudo acreditar";
/**
 * La constancia del botón de arrepentimiento (`regret.ts`). No es un "problema" del panel: queda
 * en el historial del pedido para que el personal la vea. Le sigue `: <motivo>` si lo hubo.
 */
export const STORE_NOTE_REGRET = "Arrepentimiento solicitado";
/** Hasta cuánto del motivo del arrepentimiento se guarda (el formulario no deja escribir más). */
export const STORE_REGRET_REASON_MAX = 500;

export const DEFAULT_RETURNS_POLICY =
  "Podés arrepentirte de la compra dentro de los 10 días corridos desde que retirás el producto, sin dar explicaciones, usando el botón de arrepentimiento. El producto tiene que estar sin uso y en su empaque. Te devolvemos el dinero por el mismo medio de pago.";
