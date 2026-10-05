import type { StoreOrderStatus } from "@repo/db";

/**
 * Qué cambio de estado de pedido vale y quién lo puede hacer. Módulo PURO.
 *
 * "system" es el cobro y el cron; "staff" es alguien del panel. Marcar pagado es SÓLO del
 * sistema: un pedido no se da por cobrado porque alguien lo diga, sino porque Mercado Pago lo
 * confirmó. La única excepción es `PAID_NO_STOCK → PAID`, que no cambia la plata (ya entró):
 * sólo dice que se repuso el stock.
 */
const SISTEMA: Record<StoreOrderStatus, readonly StoreOrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "PAID_NO_STOCK", "EXPIRED"],
  EXPIRED: ["PAID", "PAID_NO_STOCK"],
  CANCELLED: ["PAID_NO_STOCK"],
  PAID: [],
  READY: [],
  DELIVERED: [],
  PAID_NO_STOCK: [],
};
const PERSONAL: Record<StoreOrderStatus, readonly StoreOrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["READY", "DELIVERED", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  PAID_NO_STOCK: ["PAID", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(
  from: StoreOrderStatus,
  to: StoreOrderStatus,
  actor: "system" | "staff",
): boolean {
  return (actor === "system" ? SISTEMA : PERSONAL)[from].includes(to);
}
