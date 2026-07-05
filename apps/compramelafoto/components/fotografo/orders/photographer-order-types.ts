import type { OrderFulfillmentKind } from "@/lib/order-fulfillment";
import type { EventOrganizerSaleBreakdown } from "@/lib/event-organizer-commission-display";
import { isPreventaUxV2EnabledClient } from "@/lib/preventa-canjeable/preventa-ux-v2-feature-flag";

export type PhotographerOrderRow = {
  id: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  pickupBy: string;
  labName: string;
  createdAtText: string;
  statusUpdatedAtText: string;
  /** ISO desde API listado — solo frontend */
  createdAtIso?: string | null;
  itemsCount: number;
  currency: string;
  total: number;
  status: string;
  paymentStatus?: string | null;
  orderType?: string;
  /** OrderOrigin de Prisma — PREVENTA_PACK, PACK_REDEMPTION, STANDARD_CHECKOUT */
  origin?: string | null;
  source?: "PRINT_ORDER" | "ALBUM_ORDER";
  fulfillmentKind?: OrderFulfillmentKind;
  hasDigitalItems?: boolean;
  hasPrintItems?: boolean;
  digitalItemsCount?: number;
  printItemsCount?: number;
  downloadLinkViewedAt?: string | null;
  _dataProtected?: boolean;
  photographerInstagram?: string | null;
  photographerReceivedAmount?: number;
  clientPaidAmount?: number;
  eventOrganizerSale?: EventOrganizerSaleBreakdown | null;
  albumEventId?: number | null;
};

export type OrdersQuickFilter =
  | "ALL"
  | "PENDING"
  | "PAID"
  | "PRINT"
  | "DIGITAL"
  | "VIDEO"
  | "PREVENTA";

export const ORDERS_BASE_QUICK_FILTERS: { value: OrdersQuickFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PAID", label: "Pagados" },
  { value: "DIGITAL", label: "Digitales" },
  { value: "PRINT", label: "Impresión" },
  { value: "VIDEO", label: "Videos" },
];

/** @deprecated use buildOrdersQuickFilters */
export const ORDERS_QUICK_FILTERS = ORDERS_BASE_QUICK_FILTERS;

export function isPreventaOrder(o: PhotographerOrderRow): boolean {
  const origin = (o.origin || "").toUpperCase();
  if (origin === "PREVENTA_PACK" || origin === "PACK_REDEMPTION") return true;
  const ot = (o.orderType || "").toUpperCase();
  return ot.includes("PREVENTA") || ot.includes("PRECOMPRA");
}

export function buildOrdersQuickFilters(
  orders: PhotographerOrderRow[]
): { value: OrdersQuickFilter; label: string }[] {
  const hasPreventa = orders.some(isPreventaOrder);
  if (!hasPreventa) return ORDERS_BASE_QUICK_FILTERS;
  return [
    ...ORDERS_BASE_QUICK_FILTERS,
    {
      value: "PREVENTA",
      label: isPreventaUxV2EnabledClient() ? "Preventa" : "Escuela / Preventa",
    },
  ];
}

export function hasPrintComponent(o: PhotographerOrderRow): boolean {
  const fk = getOrderFulfillmentKind(o);
  return (
    o.source === "PRINT_ORDER" ||
    fk === "PRINT" ||
    fk === "MIXED" ||
    Boolean(o.hasPrintItems)
  );
}

export function isDownloadAvailable(o: PhotographerOrderRow): boolean {
  if (!isOrderPaid(o) || isDataProtected(o)) return false;
  if (o.source === "PRINT_ORDER") return true;
  const fk = getOrderFulfillmentKind(o);
  return fk === "DIGITAL" || fk === "MIXED" || Boolean(o.hasDigitalItems);
}

const PRINT_DONE_STATUSES = new Set(["DELIVERED", "RETIRED", "CANCELED"]);

export function isPrintPending(o: PhotographerOrderRow): boolean {
  if (!hasPrintComponent(o)) return false;
  if (isOrderPending(o)) return true;
  if (!isOrderPaid(o)) return false;
  return !PRINT_DONE_STATUSES.has(o.status);
}

export type OrdersWorkspaceStats = {
  total: number;
  pending: number;
  paid: number;
  downloadsAvailable: number;
  printPending: number;
};

export function computeOrdersWorkspaceStats(orders: PhotographerOrderRow[]): OrdersWorkspaceStats {
  let pending = 0;
  let paid = 0;
  let downloadsAvailable = 0;
  let printPending = 0;

  for (const o of orders) {
    if (isOrderPending(o)) pending++;
    if (isOrderPaid(o)) paid++;
    if (isDownloadAvailable(o)) downloadsAvailable++;
    if (isPrintPending(o)) printPending++;
  }

  return {
    total: orders.length,
    pending,
    paid,
    downloadsAvailable,
    printPending,
  };
}

export function countOrdersForQuickFilter(
  orders: PhotographerOrderRow[],
  quick: OrdersQuickFilter
): number {
  return orders.filter((o) => matchesQuickFilter(o, quick)).length;
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente de pago",
  CREATED: "Creado",
  IN_PRODUCTION: "En producción",
  READY: "Listo",
  READY_TO_PICKUP: "Listo para retirar",
  SHIPPED: "Enviado",
  RETIRED: "Retirado",
  DELIVERED: "Entregado",
  CANCELED: "Cancelado",
  PAID: "Pagado",
  FAILED: "Fallido",
  REFUNDED: "Reintegrado",
};

export const ALLOWED_STATUSES = [
  "CREATED",
  "IN_PRODUCTION",
  "READY",
  "READY_TO_PICKUP",
  "SHIPPED",
  "RETIRED",
  "DELIVERED",
  "CANCELED",
];

export function rowKey(o: PhotographerOrderRow): string {
  return `${o.source ?? "ROW"}-${o.id}`;
}

export function getOrderFulfillmentKind(o: PhotographerOrderRow): OrderFulfillmentKind {
  return o.fulfillmentKind || (o.source === "PRINT_ORDER" ? "PRINT" : "DIGITAL");
}

export function isOrderPaid(o: PhotographerOrderRow): boolean {
  if (o.source === "PRINT_ORDER") return o.paymentStatus === "PAID";
  if (o.source === "ALBUM_ORDER") return o.status === "PAID";
  return false;
}

export function isDataProtected(o: PhotographerOrderRow): boolean {
  return Boolean(o._dataProtected);
}

export function isOrderPending(o: PhotographerOrderRow): boolean {
  if (o.status === "REFUNDED" || o.paymentStatus === "REFUNDED") return false;
  if (o.source === "PRINT_ORDER") {
    return o.paymentStatus !== "PAID" && o.status !== "CANCELED";
  }
  return o.status === "PENDING" || o.status === "FAILED";
}

export function matchesQuickFilter(o: PhotographerOrderRow, quick: OrdersQuickFilter): boolean {
  if (quick === "ALL") return true;
  const fk = getOrderFulfillmentKind(o);
  if (quick === "PENDING") return isOrderPending(o);
  if (quick === "PAID") return isOrderPaid(o);
  if (quick === "PRINT") {
    return fk === "PRINT" || fk === "MIXED" || o.source === "PRINT_ORDER" || Boolean(o.hasPrintItems);
  }
  if (quick === "DIGITAL") {
    return fk === "DIGITAL" || fk === "MIXED" || Boolean(o.hasDigitalItems);
  }
  if (quick === "VIDEO") {
    const ot = (o.orderType || "").toUpperCase();
    return ot.includes("VIDEO");
  }
  if (quick === "PREVENTA") return isPreventaOrder(o);
  return true;
}

export function filterOrders(
  orders: PhotographerOrderRow[],
  quickFilter: OrdersQuickFilter,
  q: string
): PhotographerOrderRow[] {
  const qq = q.trim().toLowerCase();

  return orders.filter((o) => {
    if (!matchesQuickFilter(o, quickFilter)) return false;
    if (!qq) return true;

    const fk = getOrderFulfillmentKind(o);
    const haystack = [
      String(o.id),
      o.customerName || "",
      o.customerEmail || "",
      o.customerPhone || "",
      o.createdAtText || "",
      o.status || "",
      String(o.total ?? ""),
      o.currency || "",
      String(o.itemsCount ?? ""),
      o.labName || "",
      fk,
      o.orderType || "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(qq);
  });
}

export type OrderTypeBadgeVariant = "DIGITAL" | "PRINT" | "MIXED" | "PREVENTA" | "VIDEO";

export function getOrderTypeBadgeVariant(o: PhotographerOrderRow): OrderTypeBadgeVariant {
  const origin = (o.origin || "").toUpperCase();
  if (origin === "PREVENTA_PACK" || origin === "PACK_REDEMPTION") return "PREVENTA";
  const ot = (o.orderType || "").toUpperCase();
  if (ot.includes("PREVENTA") || ot.includes("PRECOMPRA")) return "PREVENTA";
  if (ot.includes("VIDEO")) return "VIDEO";

  const fk = getOrderFulfillmentKind(o);
  if (fk === "MIXED") return "MIXED";
  if (fk === "PRINT" || o.source === "PRINT_ORDER") return "PRINT";
  return "DIGITAL";
}

export type OperationalStatus = {
  icon: string;
  label: string;
  tone: "amber" | "emerald" | "blue" | "violet" | "gray" | "red";
};

export function getOperationalStatuses(o: PhotographerOrderRow): OperationalStatus[] {
  const statuses: OperationalStatus[] = [];
  const fk = getOrderFulfillmentKind(o);
  const paid = isOrderPaid(o);
  const protectedData = isDataProtected(o);

  if (o.paymentStatus === "REFUNDED" || o.status === "REFUNDED") {
    statuses.push({ icon: "↩", label: "Reembolsado", tone: "red" });
    return statuses;
  }

  if (!paid) {
    statuses.push({ icon: "⏳", label: "Esperando pago", tone: "amber" });
  } else {
    statuses.push({ icon: "✅", label: "Pago aprobado", tone: "emerald" });
  }

  if (o.source === "PRINT_ORDER" || fk === "PRINT" || fk === "MIXED") {
    const printStatus = STATUS_LABEL[o.status] || o.status;
    if (o.status === "CREATED" || o.status === "READY") {
      statuses.push({ icon: "📦", label: "Listo para imprimir", tone: "blue" });
    } else if (o.status === "IN_PRODUCTION") {
      statuses.push({ icon: "🖨", label: "En producción", tone: "violet" });
    } else if (printStatus && o.source === "PRINT_ORDER") {
      statuses.push({ icon: "📋", label: printStatus, tone: "blue" });
    }

    if (o.labName && o.labName !== "-") {
      statuses.push({ icon: "🖨", label: `Lab: ${o.labName}`, tone: "violet" });
    }
  }

  if (fk === "DIGITAL" || fk === "MIXED" || o.hasDigitalItems) {
    if (paid && !protectedData) {
      statuses.push({ icon: "⬇", label: "Descarga disponible", tone: "emerald" });
    } else if (protectedData) {
      statuses.push({ icon: "🔒", label: "Visible luego del pago", tone: "gray" });
    }
  }

  if (o.source === "ALBUM_ORDER" && paid) {
    if (o.downloadLinkViewedAt) {
      statuses.push({ icon: "👁", label: "Cliente descargó", tone: "emerald" });
    }
  }

  return statuses;
}

export function getPaymentStatusLabel(o: PhotographerOrderRow): string {
  if (o.paymentStatus === "REFUNDED" || o.status === "REFUNDED") return "Reembolsado";
  if (isOrderPaid(o)) return "Pagado";
  return "Pago pendiente";
}

export function getOperationalStatusGroups(o: PhotographerOrderRow): {
  primary: OperationalStatus | null;
  secondary: OperationalStatus[];
} {
  const statuses = getOperationalStatuses(o);
  if (statuses.length === 0) return { primary: null, secondary: [] };
  return {
    primary: statuses[0] ?? null,
    secondary: statuses.slice(1),
  };
}

export function getPickupLabel(pickupBy: string): string {
  if (pickupBy === "PHOTOGRAPHER") return "Retira fotógrafo";
  if (pickupBy === "DIGITAL") return "Entrega digital";
  return "Retira cliente";
}
