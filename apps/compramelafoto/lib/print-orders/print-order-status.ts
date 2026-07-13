/**
 * Reglas de estado para pedidos de impresión (API P0).
 * Paridad con legacy ALLOWED + guardas de transición terminal.
 */

export const PRINT_ORDER_STATUSES = [
  "CREATED",
  "IN_PRODUCTION",
  "READY",
  "READY_TO_PICKUP",
  "SHIPPED",
  "RETIRED",
  "DELIVERED",
  "CANCELED",
] as const;

export type PrintOrderStatusValue = (typeof PRINT_ORDER_STATUSES)[number];

export const PRINT_ORDER_STATUS_SET = new Set<string>(PRINT_ORDER_STATUSES);

/** Estados terminales: no se puede volver a producción salvo CANCELED→(no) / ADMIN override no implementado. */
const TERMINAL = new Set<string>(["DELIVERED", "CANCELED", "RETIRED"]);

/**
 * Transiciones permitidas (grafo operativo de lab).
 * Idempotencia: from === to siempre OK.
 */
const ALLOWED_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  // Tras pago MP suele ir a IN_PRODUCTION; UI de lab/fotógrafo también puede marcar listo.
  CREATED: new Set([
    "CREATED",
    "IN_PRODUCTION",
    "READY",
    "READY_TO_PICKUP",
    "SHIPPED",
    "CANCELED",
  ]),
  IN_PRODUCTION: new Set([
    "IN_PRODUCTION",
    "READY",
    "READY_TO_PICKUP",
    "SHIPPED",
    "CANCELED",
  ]),
  READY: new Set(["READY", "READY_TO_PICKUP", "SHIPPED", "RETIRED", "DELIVERED", "CANCELED"]),
  READY_TO_PICKUP: new Set([
    "READY_TO_PICKUP",
    "READY",
    "SHIPPED",
    "RETIRED",
    "DELIVERED",
    "CANCELED",
  ]),
  SHIPPED: new Set(["SHIPPED", "DELIVERED", "RETIRED", "CANCELED"]),
  RETIRED: new Set(["RETIRED"]),
  DELIVERED: new Set(["DELIVERED"]),
  CANCELED: new Set(["CANCELED"]),
};

export const BULK_STATUS_MAX_IDS = 100;

export function isAllowedPrintOrderStatus(status: string): status is PrintOrderStatusValue {
  return PRINT_ORDER_STATUS_SET.has(status);
}

export function canTransitionPrintOrderStatus(
  from: string,
  to: string
): { ok: true } | { ok: false; reason: string } {
  if (!isAllowedPrintOrderStatus(to)) {
    return { ok: false, reason: "Estado destino inválido" };
  }
  if (from === to) {
    return { ok: true };
  }
  if (TERMINAL.has(from) && from !== to) {
    return {
      ok: false,
      reason: `No se puede cambiar un pedido en estado terminal (${from})`,
    };
  }
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed || !allowed.has(to)) {
    return {
      ok: false,
      reason: `Transición no permitida: ${from} → ${to}`,
    };
  }
  return { ok: true };
}
