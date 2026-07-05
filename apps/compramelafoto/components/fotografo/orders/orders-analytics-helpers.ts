import { getOrderCreatedAt } from "./orders-activity-helpers";
import { getOrderTypeLabel } from "./order-detail-helpers";
import {
  getOrderFulfillmentKind,
  getOrderTypeBadgeVariant,
  isDownloadAvailable,
  isOrderPaid,
  isPrintPending,
  type PhotographerOrderRow,
} from "./photographer-order-types";

export type OrdersAnalyticsKpis = {
  totalRevenue: number;
  paidOrders: number;
  averageTicket: number;
  downloadsCompleted: number;
  digitalPct: number;
  printPct: number;
  currency: string;
};

export type OrdersDailySalesPoint = {
  key: string;
  label: string;
  revenue: number;
  orders: number;
};

export type OrdersTypeChartPoint = {
  type: string;
  count: number;
  revenue: number;
  fill: string;
};

export type OrdersDownloadChartPoint = {
  name: string;
  value: number;
  fill: string;
};

export type OrdersRankingRow = {
  id: string;
  label: string;
  count: number;
  revenue: number;
};

export type OrdersAnalyticsInsight = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

export type OrdersAnalyticsSnapshot = {
  kpis: OrdersAnalyticsKpis;
  dailySales: OrdersDailySalesPoint[];
  ordersByType: OrdersTypeChartPoint[];
  downloadsChart: OrdersDownloadChartPoint[];
  fulfillmentMix: OrdersDownloadChartPoint[];
  activityChart: OrdersDownloadChartPoint[];
  insights: OrdersAnalyticsInsight[];
  topEvents: OrdersRankingRow[];
  topAlbums: OrdersRankingRow[];
  topSaleTypes: OrdersRankingRow[];
};

const TYPE_COLORS: Record<string, string> = {
  DIGITAL: "#0ea5e9",
  PRINT: "#f97316",
  MIXED: "#8b5cf6",
  VIDEO: "#a855f7",
  PREVENTA: "#10b981",
};

const TYPE_LABELS: Record<string, string> = {
  DIGITAL: "Digital",
  PRINT: "Impresión",
  MIXED: "Mixto",
  VIDEO: "Video",
  PREVENTA: "Preventa",
};

export function formatAnalyticsMoney(amount: number, currency = "ARS"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatAnalyticsPct(value: number): string {
  return `${Math.round(value)}%`;
}

function getReceivedAmount(order: PhotographerOrderRow): number {
  if (!isOrderPaid(order)) return 0;
  return (
    order.photographerReceivedAmount ??
    order.eventOrganizerSale?.photographerNetAmount ??
    order.total ??
    0
  );
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function buildLast7Days(now = new Date()): { key: string; label: string; date: Date }[] {
  const fmt = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric" });
  const days: { key: string; label: string; date: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - i);
    days.push({
      key: dayKey(date),
      label: fmt.format(date).replace(".", ""),
      date,
    });
  }
  return days;
}

function isVideoOrder(order: PhotographerOrderRow): boolean {
  return (order.orderType || "").toUpperCase().includes("VIDEO");
}

function getEventLabel(order: PhotographerOrderRow): string | null {
  const title = order.eventOrganizerSale?.eventTitle?.trim();
  if (title) return title;
  const eventId = order.albumEventId ?? order.eventOrganizerSale?.eventId;
  if (eventId) return `Evento #${eventId}`;
  return null;
}

function bumpRanking(
  map: Map<string, OrdersRankingRow>,
  id: string,
  label: string,
  revenue: number
) {
  const prev = map.get(id);
  if (prev) {
    prev.count += 1;
    prev.revenue += revenue;
  } else {
    map.set(id, { id, label, count: 1, revenue });
  }
}

function topRankings(map: Map<string, OrdersRankingRow>, limit = 5): OrdersRankingRow[] {
  return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.count - a.count).slice(0, limit);
}

export function computeOrdersAnalyticsSnapshot(
  orders: PhotographerOrderRow[],
  now = Date.now()
): OrdersAnalyticsSnapshot {
  const nowDate = new Date(now);
  const last7 = buildLast7Days(nowDate);
  const dailyMap = new Map(last7.map((d) => [d.key, { revenue: 0, orders: 0 }]));

  let totalRevenue = 0;
  let paidOrders = 0;
  let downloadsCompleted = 0;
  let digitalPaid = 0;
  let printPaid = 0;
  let mixedPaid = 0;

  const typeCounts = new Map<string, { count: number; revenue: number }>();
  let downloadsPending = 0;
  let downloadsDone = 0;
  let printActive = 0;
  let printDone = 0;
  let videoCount = 0;
  let recentRevenue = 0;
  let priorRevenue = 0;

  const eventsMap = new Map<string, OrdersRankingRow>();
  const albumsMap = new Map<string, OrdersRankingRow>();
  const saleTypesMap = new Map<string, OrdersRankingRow>();

  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  for (const order of orders) {
    const paid = isOrderPaid(order);
    const revenue = getReceivedAmount(order);
    const created = getOrderCreatedAt(order);
    const variant = getOrderTypeBadgeVariant(order);
    const typeLabel = TYPE_LABELS[variant] ?? getOrderTypeLabel(order);
    const fk = getOrderFulfillmentKind(order);

    if (paid) {
      paidOrders++;
      totalRevenue += revenue;

      const dk = dayKey(created);
      const bucket = dailyMap.get(dk);
      if (bucket) {
        bucket.revenue += revenue;
        bucket.orders += 1;
      }

      const age = now - created.getTime();
      if (age <= threeDaysMs) recentRevenue += revenue;
      else if (age <= threeDaysMs * 2) priorRevenue += revenue;

      const tc = typeCounts.get(variant) ?? { count: 0, revenue: 0 };
      tc.count += 1;
      tc.revenue += revenue;
      typeCounts.set(variant, tc);

      if (variant === "DIGITAL") digitalPaid++;
      else if (variant === "PRINT") printPaid++;
      else if (variant === "MIXED") mixedPaid++;

      bumpRanking(saleTypesMap, variant, typeLabel, revenue);

      if (order.source === "ALBUM_ORDER") {
        bumpRanking(albumsMap, `album-${variant}`, `Álbum · ${typeLabel}`, revenue);
      }

      const eventLabel = getEventLabel(order);
      if (eventLabel) {
        const eid = String(order.albumEventId ?? order.eventOrganizerSale?.eventId ?? eventLabel);
        bumpRanking(eventsMap, eid, eventLabel, revenue);
      }
    }

    if (order.downloadLinkViewedAt) downloadsCompleted++;

    if (paid && isDownloadAvailable(order) && (fk === "DIGITAL" || fk === "MIXED" || order.hasDigitalItems)) {
      if (order.downloadLinkViewedAt) downloadsDone++;
      else downloadsPending++;
    }

    if (paid && (order.source === "PRINT_ORDER" || fk === "PRINT" || fk === "MIXED")) {
      if (isPrintPending(order)) printActive++;
      else printDone++;
    }

    if (isVideoOrder(order) && paid) videoCount++;
  }

  const paidMixTotal = digitalPaid + printPaid + mixedPaid;
  const digitalPct = paidMixTotal > 0 ? ((digitalPaid + mixedPaid * 0.5) / paidMixTotal) * 100 : 0;
  const printPct = paidMixTotal > 0 ? ((printPaid + mixedPaid * 0.5) / paidMixTotal) * 100 : 0;

  const currency = orders.find((o) => o.currency)?.currency ?? "ARS";

  const kpis: OrdersAnalyticsKpis = {
    totalRevenue,
    paidOrders,
    averageTicket: paidOrders > 0 ? Math.round(totalRevenue / paidOrders) : 0,
    downloadsCompleted,
    digitalPct,
    printPct,
    currency,
  };

  const dailySales: OrdersDailySalesPoint[] = last7.map((d) => {
    const bucket = dailyMap.get(d.key)!;
    return {
      key: d.key,
      label: d.label,
      revenue: bucket.revenue,
      orders: bucket.orders,
    };
  });

  const ordersByType: OrdersTypeChartPoint[] = [...typeCounts.entries()]
    .map(([type, data]) => ({
      type: TYPE_LABELS[type] ?? type,
      count: data.count,
      revenue: data.revenue,
      fill: TYPE_COLORS[type] ?? "#94a3b8",
    }))
    .sort((a, b) => b.count - a.count);

  const downloadsChart: OrdersDownloadChartPoint[] = [
    { name: "Descargadas", value: downloadsDone, fill: "#10b981" },
    { name: "Pendientes", value: downloadsPending, fill: "#fbbf24" },
  ].filter((p) => p.value > 0);

  const fulfillmentMix: OrdersDownloadChartPoint[] = [
    { name: "Digital", value: digitalPaid, fill: TYPE_COLORS.DIGITAL },
    { name: "Impresión", value: printPaid, fill: TYPE_COLORS.PRINT },
    { name: "Mixto", value: mixedPaid, fill: TYPE_COLORS.MIXED },
  ].filter((p) => p.value > 0);

  const activityChart: OrdersDownloadChartPoint[] = [
    { name: "Impresión activa", value: printActive, fill: "#f97316" },
    { name: "Impresión cerrada", value: printDone, fill: "#22c55e" },
    { name: "Videos pagos", value: videoCount, fill: TYPE_COLORS.VIDEO },
  ].filter((p) => p.value > 0);

  const insights = buildAnalyticsInsights({
    ordersCount: orders.length,
    paidOrders,
    recentRevenue,
    priorRevenue,
    digitalPct,
    printPct,
    downloadsDone,
    downloadsPending,
    ordersByType,
    videoCount,
  });

  return {
    kpis,
    dailySales,
    ordersByType,
    downloadsChart,
    fulfillmentMix,
    activityChart,
    insights,
    topEvents: topRankings(eventsMap),
    topAlbums: topRankings(albumsMap),
    topSaleTypes: topRankings(saleTypesMap),
  };
}

function buildAnalyticsInsights(input: {
  ordersCount: number;
  paidOrders: number;
  recentRevenue: number;
  priorRevenue: number;
  digitalPct: number;
  printPct: number;
  downloadsDone: number;
  downloadsPending: number;
  ordersByType: OrdersTypeChartPoint[];
  videoCount: number;
}): OrdersAnalyticsInsight[] {
  const insights: OrdersAnalyticsInsight[] = [];

  if (input.ordersCount === 0) {
    return [
      {
        id: "empty",
        icon: "📊",
        title: "Sin datos aún",
        description: "Cuando ingresen pedidos, acá verás tendencias y rankings.",
      },
    ];
  }

  if (input.priorRevenue > 0) {
    const growth = ((input.recentRevenue - input.priorRevenue) / input.priorRevenue) * 100;
    if (growth >= 10) {
      insights.push({
        id: "growth-up",
        icon: "📈",
        title: "Ingresos en alza",
        description: `Los últimos 3 días superan al tramo anterior (~${Math.round(growth)}%).`,
      });
    } else if (growth <= -10) {
      insights.push({
        id: "growth-down",
        icon: "📉",
        title: "Desaceleración reciente",
        description: `Ingresos de los últimos 3 días ~${Math.abs(Math.round(growth))}% por debajo del tramo previo.`,
      });
    }
  } else if (input.recentRevenue > 0) {
    insights.push({
      id: "growth-new",
      icon: "✨",
      title: "Actividad reciente",
      description: "Hay ventas acreditadas en los últimos 3 días.",
    });
  }

  const top = input.ordersByType[0];
  if (top) {
    insights.push({
      id: "dominant-type",
      icon: "🏷",
      title: `${top.type} lidera`,
      description: `${top.count} pedido${top.count === 1 ? "" : "s"} pagos en este formato.`,
    });
  }

  const downloadTotal = input.downloadsDone + input.downloadsPending;
  if (downloadTotal > 0) {
    const conv = (input.downloadsDone / downloadTotal) * 100;
    insights.push({
      id: "download-conv",
      icon: "⬇",
      title: `${Math.round(conv)}% descargó`,
      description: `${input.downloadsDone} de ${downloadTotal} pedidos digitales con descarga registrada.`,
    });
  }

  if (input.digitalPct > input.printPct + 15) {
    insights.push({
      id: "digital-heavy",
      icon: "💫",
      title: "Operación digital-first",
      description: `~${Math.round(input.digitalPct)}% de tus ventas pagas tienen componente digital.`,
    });
  } else if (input.printPct > input.digitalPct + 15) {
    insights.push({
      id: "print-heavy",
      icon: "🖨",
      title: "Impresión protagonista",
      description: `~${Math.round(input.printPct)}% de tus ventas pagas incluyen impresión.`,
    });
  }

  if (input.videoCount > 0) {
    insights.push({
      id: "video",
      icon: "🎥",
      title: "Videos en el mix",
      description: `${input.videoCount} pedido${input.videoCount === 1 ? "" : "s"} de video acreditado${input.videoCount === 1 ? "" : "s"}.`,
    });
  }

  return insights.slice(0, 5);
}
