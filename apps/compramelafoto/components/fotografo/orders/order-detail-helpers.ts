import { getFulfillmentKindLabel, type OrderFulfillmentKind } from "@/lib/order-fulfillment";
import {
  STATUS_LABEL,
  getOrderFulfillmentKind,
  getOrderTypeBadgeVariant,
  getPickupLabel,
  isDataProtected,
  isOrderPaid,
  type PhotographerOrderRow,
} from "./photographer-order-types";

export type OrderTimelineEvent = {
  icon: string;
  label: string;
  time: string;
  done: boolean;
};

export type OrderProductLine = {
  label: string;
  detail?: string;
};

const TYPE_LABELS: Record<string, string> = {
  DIGITAL: "Digital",
  PRINT: "Impresión",
  MIXED: "Mixto",
  PREVENTA: "Preventa",
  VIDEO: "Video",
};

export function getOrderTypeLabel(order: PhotographerOrderRow): string {
  const variant = getOrderTypeBadgeVariant(order);
  return TYPE_LABELS[variant] ?? getFulfillmentKindLabel(getOrderFulfillmentKind(order) as OrderFulfillmentKind);
}

export function buildOrderProductLines(order: PhotographerOrderRow): OrderProductLine[] {
  const lines: OrderProductLine[] = [];
  const fk = getOrderFulfillmentKind(order);
  const dc = order.digitalItemsCount ?? 0;
  const pc = order.printItemsCount ?? 0;

  if (dc > 0) {
    lines.push({
      label: `${dc} foto${dc !== 1 ? "s" : ""} digital${dc !== 1 ? "es" : ""}`,
      detail: "Descarga ZIP",
    });
  }
  if (pc > 0) {
    lines.push({
      label: `${pc} impresión${pc !== 1 ? "es" : ""}`,
      detail: order.labName && order.labName !== "-" ? order.labName : undefined,
    });
  }
  if (lines.length === 0) {
    lines.push({
      label: `${order.itemsCount} ítem${order.itemsCount !== 1 ? "s" : ""}`,
      detail: getOrderTypeLabel(order),
    });
  }
  return lines;
}

export function buildOrderTimeline(order: PhotographerOrderRow): OrderTimelineEvent[] {
  const events: OrderTimelineEvent[] = [];
  const paid = isOrderPaid(order);
  const fk = getOrderFulfillmentKind(order);

  events.push({
    icon: "📝",
    label: "Pedido creado",
    time: order.createdAtText,
    done: true,
  });

  if (paid) {
    events.push({
      icon: "✅",
      label: "Pago acreditado",
      time: order.statusUpdatedAtText || order.createdAtText,
      done: true,
    });
  } else if (order.status === "PENDING" || order.paymentStatus === "PENDING") {
    events.push({
      icon: "⏳",
      label: "Esperando pago",
      time: order.statusUpdatedAtText || "—",
      done: false,
    });
  }

  if (order.source === "ALBUM_ORDER" && paid && order.downloadLinkViewedAt) {
    events.push({
      icon: "👁",
      label: "Cliente descargó",
      time: new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(order.downloadLinkViewedAt)),
      done: true,
    });
  }

  if (order.source === "PRINT_ORDER" || fk === "PRINT" || fk === "MIXED") {
    const printLabel = STATUS_LABEL[order.status] || order.status;
    if (order.status === "CREATED" || order.status === "READY") {
      events.push({
        icon: "📦",
        label: "Listo para imprimir",
        time: order.statusUpdatedAtText,
        done: paid,
      });
    } else if (order.status === "DELIVERED" || order.status === "RETIRED") {
      events.push({
        icon: "✓",
        label: printLabel,
        time: order.statusUpdatedAtText,
        done: true,
      });
    } else if (order.source === "PRINT_ORDER") {
      events.push({
        icon: "🖨",
        label: printLabel,
        time: order.statusUpdatedAtText,
        done: paid && order.status !== "CANCELED",
      });
    }
  }

  if (paid && !isDataProtected(order) && (fk === "DIGITAL" || order.hasDigitalItems)) {
    if (!order.downloadLinkViewedAt) {
      events.push({
        icon: "⬇",
        label: "Descarga disponible",
        time: "—",
        done: true,
      });
    }
  }

  return events;
}

export function getPrintStatusLabel(order: PhotographerOrderRow): string | null {
  const fk = getOrderFulfillmentKind(order);
  if (order.source !== "PRINT_ORDER" && fk !== "PRINT" && fk !== "MIXED") return null;
  return STATUS_LABEL[order.status] || order.status;
}

export function getDownloadStatusLabel(order: PhotographerOrderRow): string {
  if (!isOrderPaid(order)) return "Esperando acreditación";
  if (isDataProtected(order)) return "Protegido hasta pago";
  if (order.downloadLinkViewedAt) return "Cliente descargó";
  return "Disponible";
}

export { getPickupLabel };
