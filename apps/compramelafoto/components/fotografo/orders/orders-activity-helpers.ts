import {
  getOrderFulfillmentKind,
  isDataProtected,
  isDownloadAvailable,
  isOrderPaid,
  isOrderPending,
  isPrintPending,
  isPreventaOrder,
  rowKey,
  STATUS_LABEL,
  type OrdersQuickFilter,
  type PhotographerOrderRow,
} from "./photographer-order-types";

export type OrderActivityKind =
  | "payment"
  | "download"
  | "print_ready"
  | "print_progress"
  | "print_done"
  | "new_order"
  | "pending_stale"
  | "video"
  | "export"
  | "preventa"
  | "failed"
  | "refunded";

export type OrderActivityEvent = {
  id: string;
  orderKey: string;
  orderId: number;
  kind: OrderActivityKind;
  icon: string;
  title: string;
  subtitle?: string;
  timestamp: Date;
  tone: "emerald" | "sky" | "amber" | "orange" | "violet" | "rose" | "gray" | "blue";
  filter?: OrdersQuickFilter;
};

export type OrdersAttentionItem = {
  id: string;
  label: string;
  count: number;
  tone: "amber" | "orange" | "sky" | "rose";
  filter: OrdersQuickFilter;
};

export type OrdersAttentionSummary = {
  items: OrdersAttentionItem[];
  totalCount: number;
};

const STALE_PENDING_DAYS = 3;
const RECENT_ORDER_HOURS = 72;
const MAX_FEED_EVENTS = 18;

export function parseOrderIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function formatRelativeTimeEs(date: Date, now = Date.now()): string {
  const diffMs = Math.max(0, now - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} día${days === 1 ? "" : "s"}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `hace ${weeks} sem`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months === 1 ? "" : "es"}`;
}

function parseEsArDateText(text: string | null | undefined): Date | null {
  if (!text) return null;
  const match = text.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const d = new Date(year, month - 1, day, hour, minute, second);
  return Number.isFinite(d.getTime()) ? d : null;
}

function getOrderCreatedAt(order: PhotographerOrderRow): Date {
  return (
    parseOrderIso(order.createdAtIso) ??
    parseEsArDateText(order.createdAtText) ??
    new Date(0)
  );
}

export { getOrderCreatedAt };

function daysSince(date: Date, now = Date.now()): number {
  return Math.floor((now - date.getTime()) / (24 * 60 * 60 * 1000));
}

function isRecent(date: Date, hours: number, now = Date.now()): boolean {
  return now - date.getTime() <= hours * 60 * 60 * 1000;
}

function isVideoOrder(order: PhotographerOrderRow): boolean {
  return (order.orderType || "").toUpperCase().includes("VIDEO");
}

export function buildOrderActivityEvents(
  orders: PhotographerOrderRow[],
  now = Date.now()
): OrderActivityEvent[] {
  const events: OrderActivityEvent[] = [];

  for (const order of orders) {
    const key = rowKey(order);
    const created = getOrderCreatedAt(order);
    const fk = getOrderFulfillmentKind(order);
    const paid = isOrderPaid(order);
    const pending = isOrderPending(order);

    if (order.status === "REFUNDED" || order.paymentStatus === "REFUNDED") {
      events.push({
        id: `${key}-refunded`,
        orderKey: key,
        orderId: order.id,
        kind: "refunded",
        icon: "↩",
        title: `Pedido #${order.id} reembolsado`,
        timestamp: created,
        tone: "gray",
        filter: "ALL",
      });
      continue;
    }

    if (order.status === "FAILED" || order.paymentStatus === "FAILED") {
      events.push({
        id: `${key}-failed`,
        orderKey: key,
        orderId: order.id,
        kind: "failed",
        icon: "⚠",
        title: `Pedido #${order.id} con pago fallido`,
        timestamp: created,
        tone: "rose",
        filter: "PENDING",
      });
    }

    if (pending && daysSince(created, now) >= STALE_PENDING_DAYS) {
      events.push({
        id: `${key}-stale`,
        orderKey: key,
        orderId: order.id,
        kind: "pending_stale",
        icon: "⚠",
        title: `Pedido #${order.id} pendiente hace ${daysSince(created, now)} días`,
        subtitle: isDataProtected(order) ? "Cliente protegido" : order.customerName ?? undefined,
        timestamp: created,
        tone: "amber",
        filter: "PENDING",
      });
    }

    if (pending && isRecent(created, RECENT_ORDER_HOURS, now)) {
      events.push({
        id: `${key}-new-pending`,
        orderKey: key,
        orderId: order.id,
        kind: "new_order",
        icon: "🆕",
        title: `Nuevo pedido #${order.id} esperando pago`,
        timestamp: created,
        tone: "amber",
        filter: "PENDING",
      });
    }

    if (paid && isRecent(created, RECENT_ORDER_HOURS, now)) {
      if (isVideoOrder(order)) {
        events.push({
          id: `${key}-video`,
          orderKey: key,
          orderId: order.id,
          kind: "video",
          icon: "🎥",
          title: `Nuevo pedido de video #${order.id}`,
          timestamp: created,
          tone: "violet",
          filter: "VIDEO",
        });
      } else if (isPreventaOrder(order)) {
        events.push({
          id: `${key}-preventa`,
          orderKey: key,
          orderId: order.id,
          kind: "preventa",
          icon: "🎓",
          title: `Pedido preventa #${order.id} acreditado`,
          timestamp: created,
          tone: "blue",
          filter: "PREVENTA",
        });
      } else {
        events.push({
          id: `${key}-new-paid`,
          orderKey: key,
          orderId: order.id,
          kind: "new_order",
          icon: "📥",
          title: `Nuevo pedido #${order.id} registrado`,
          timestamp: created,
          tone: "gray",
          filter: "ALL",
        });
      }
    }

    if (paid) {
      events.push({
        id: `${key}-paid`,
        orderKey: key,
        orderId: order.id,
        kind: "payment",
        icon: "✅",
        title: `Pedido #${order.id} pagado`,
        subtitle: order.total ? `$${order.total.toLocaleString("es-AR")}` : undefined,
        timestamp: created,
        tone: "emerald",
        filter: "PAID",
      });
    }

    const downloadedAt = parseOrderIso(order.downloadLinkViewedAt);
    if (downloadedAt) {
      events.push({
        id: `${key}-download`,
        orderKey: key,
        orderId: order.id,
        kind: "download",
        icon: "⬇",
        title: `Cliente descargó pedido #${order.id}`,
        timestamp: downloadedAt,
        tone: "sky",
        filter: "DIGITAL",
      });
    } else if (paid && isDownloadAvailable(order) && (fk === "DIGITAL" || fk === "MIXED" || order.hasDigitalItems)) {
      events.push({
        id: `${key}-export-digital`,
        orderKey: key,
        orderId: order.id,
        kind: "export",
        icon: "📦",
        title: `Descarga disponible — pedido #${order.id}`,
        subtitle: "Cliente aún no descargó",
        timestamp: created,
        tone: "sky",
        filter: "DIGITAL",
      });
    }

    if (order.source === "PRINT_ORDER" || fk === "PRINT" || fk === "MIXED") {
      if (paid && (order.status === "CREATED" || order.status === "READY")) {
        events.push({
          id: `${key}-print-ready`,
          orderKey: key,
          orderId: order.id,
          kind: "print_ready",
          icon: "🖨",
          title: `Pedido #${order.id} listo para imprimir`,
          timestamp: created,
          tone: "orange",
          filter: "PRINT",
        });
      }

      if (order.status === "IN_PRODUCTION") {
        events.push({
          id: `${key}-print-prod`,
          orderKey: key,
          orderId: order.id,
          kind: "print_progress",
          icon: "🖨",
          title: `Pedido #${order.id} en producción`,
          timestamp: created,
          tone: "violet",
          filter: "PRINT",
        });
      }

      if (order.status === "SHIPPED" || order.status === "DELIVERED" || order.status === "RETIRED") {
        const label = STATUS_LABEL[order.status] || order.status;
        events.push({
          id: `${key}-print-done`,
          orderKey: key,
          orderId: order.id,
          kind: "print_done",
          icon: "📦",
          title: `Pedido #${order.id} — ${label.toLowerCase()}`,
          timestamp: created,
          tone: "emerald",
          filter: "PRINT",
        });
      }

      if (paid && isDownloadAvailable(order) && order.source === "PRINT_ORDER") {
        events.push({
          id: `${key}-export-print`,
          orderKey: key,
          orderId: order.id,
          kind: "export",
          icon: "📦",
          title: `Exportación disponible — pedido #${order.id}`,
          timestamp: created,
          tone: "orange",
          filter: "PRINT",
        });
      }
    }
  }

  return events
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, MAX_FEED_EVENTS);
}

export function buildOrdersAttentionSummary(
  orders: PhotographerOrderRow[],
  now = Date.now()
): OrdersAttentionSummary {
  let stalePending = 0;
  let printPending = 0;
  let awaitingClientDownload = 0;
  let failed = 0;

  for (const order of orders) {
    const created = getOrderCreatedAt(order);

    if (isOrderPending(order) && daysSince(created, now) >= STALE_PENDING_DAYS) {
      stalePending++;
    }

    if (isPrintPending(order)) {
      printPending++;
    }

    if (
      isOrderPaid(order) &&
      isDownloadAvailable(order) &&
      !order.downloadLinkViewedAt &&
      (order.hasDigitalItems || getOrderFulfillmentKind(order) === "DIGITAL" || getOrderFulfillmentKind(order) === "MIXED")
    ) {
      awaitingClientDownload++;
    }

    if (order.status === "FAILED" || order.paymentStatus === "FAILED") {
      failed++;
    }
  }

  const items: OrdersAttentionItem[] = [];

  if (stalePending > 0) {
    items.push({
      id: "stale-pending",
      label: "Pendientes viejos",
      count: stalePending,
      tone: "amber",
      filter: "PENDING",
    });
  }

  if (printPending > 0) {
    items.push({
      id: "print-pending",
      label: "Impresión pendiente",
      count: printPending,
      tone: "orange",
      filter: "PRINT",
    });
  }

  if (awaitingClientDownload > 0) {
    items.push({
      id: "awaiting-download",
      label: "Sin descarga del cliente",
      count: awaitingClientDownload,
      tone: "sky",
      filter: "DIGITAL",
    });
  }

  if (failed > 0) {
    items.push({
      id: "failed",
      label: "Pagos fallidos",
      count: failed,
      tone: "rose",
      filter: "PENDING",
    });
  }

  return {
    items,
    totalCount: items.reduce((sum, item) => sum + item.count, 0),
  };
}

export const ACTIVITY_TONE_CLASSES: Record<OrderActivityEvent["tone"], string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  orange: "bg-orange-50 text-orange-700 ring-orange-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  gray: "bg-gray-100 text-gray-700 ring-gray-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
};
