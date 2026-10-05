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
  SHIPPED: [],
};

/** Pedido para retirar: se prepara, queda listo y se entrega. Nunca se despacha. */
const PERSONAL_RETIRO: Record<StoreOrderStatus, readonly StoreOrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["READY", "DELIVERED", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  PAID_NO_STOCK: ["PAID", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: [],
  SHIPPED: [],
};

/**
 * Pedido con envío: se despacha y después se entrega. "Listo para retirar" no existe (nadie lo
 * pasa a buscar) y no se da por entregado sin despacharlo antes. `READY` queda con salida por si
 * un pedido viejo llegara ahí: no se ofrece, pero tampoco se queda trabado (se puede despachar).
 */
const PERSONAL_ENVIO: Record<StoreOrderStatus, readonly StoreOrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  READY: ["SHIPPED", "DELIVERED", "CANCELLED"],
  PAID_NO_STOCK: ["PAID", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: [],
};

/**
 * El personal necesita la forma de entrega del pedido (`StoreOrder.deliveryMethod`): lo que se
 * puede hacer con un envío no es lo mismo que con un retiro. Cualquier valor que no sea
 * `"SHIPPING"` se trata como retiro (los pedidos de la etapa 1 son todos retiro).
 */
export function canTransition(from: StoreOrderStatus, to: StoreOrderStatus, actor: "system"): boolean;
export function canTransition(
  from: StoreOrderStatus,
  to: StoreOrderStatus,
  actor: "staff",
  deliveryMethod: string,
): boolean;
export function canTransition(
  from: StoreOrderStatus,
  to: StoreOrderStatus,
  actor: "system" | "staff",
  deliveryMethod?: string,
): boolean {
  const tabla = actor === "system" ? SISTEMA : deliveryMethod === "SHIPPING" ? PERSONAL_ENVIO : PERSONAL_RETIRO;
  return tabla[from].includes(to);
}
