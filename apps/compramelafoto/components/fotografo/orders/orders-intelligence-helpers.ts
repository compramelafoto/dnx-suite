import { getOrderCreatedAt } from "./orders-activity-helpers";
import {
  getOrderFulfillmentKind,
  isDataProtected,
  isDownloadAvailable,
  isOrderPaid,
  isOrderPending,
  isPrintPending,
  type OrdersQuickFilter,
  type PhotographerOrderRow,
} from "./photographer-order-types";

export type OperationalInsightTone = "positive" | "neutral" | "warning" | "info" | "violet";

export type OperationalInsight = {
  id: string;
  icon: string;
  title: string;
  description: string;
  tone: OperationalInsightTone;
  filter?: OrdersQuickFilter;
};

export type OperationalRecommendation = {
  id: string;
  icon: string;
  title: string;
  description: string;
  ctaLabel: string;
  filter?: OrdersQuickFilter;
};

export type OperationalHealthLabel = "Excelente" | "Bien" | "Atención" | "Crítico";

export type OperationalHealth = {
  score: number;
  label: OperationalHealthLabel;
  tone: "emerald" | "sky" | "amber" | "rose";
  summary: string;
};

export type OrdersOperationalMetrics = {
  total: number;
  stalePending: number;
  failedPayments: number;
  awaitingClientDownload: number;
  printPending: number;
  printReady: number;
  protectedOrders: number;
  protectedPending: number;
  recentOrders: number;
  recentPaid: number;
  videoOrders: number;
  recentVideoOrders: number;
  digitalPaid: number;
  printPaid: number;
  mixedPaid: number;
};

const STALE_PENDING_DAYS = 3;
const RECENT_HOURS = 72;
const VIDEO_GROWTH_DAYS = 14;

function daysSince(date: Date, now = Date.now()): number {
  return Math.floor((now - date.getTime()) / (24 * 60 * 60 * 1000));
}

function isRecentHours(date: Date, hours: number, now = Date.now()): boolean {
  return now - date.getTime() <= hours * 60 * 60 * 1000;
}

function isVideoOrder(order: PhotographerOrderRow): boolean {
  return (order.orderType || "").toUpperCase().includes("VIDEO");
}

export function computeOrdersOperationalMetrics(
  orders: PhotographerOrderRow[],
  now = Date.now()
): OrdersOperationalMetrics {
  let stalePending = 0;
  let failedPayments = 0;
  let awaitingClientDownload = 0;
  let printPending = 0;
  let printReady = 0;
  let protectedOrders = 0;
  let protectedPending = 0;
  let recentOrders = 0;
  let recentPaid = 0;
  let videoOrders = 0;
  let recentVideoOrders = 0;
  let digitalPaid = 0;
  let printPaid = 0;
  let mixedPaid = 0;

  for (const order of orders) {
    const created = getOrderCreatedAt(order);
    const fk = getOrderFulfillmentKind(order);
    const paid = isOrderPaid(order);
    const pending = isOrderPending(order);

    if (isDataProtected(order)) {
      protectedOrders++;
      if (pending) protectedPending++;
    }

    if (pending && daysSince(created, now) >= STALE_PENDING_DAYS) stalePending++;
    if (order.status === "FAILED" || order.paymentStatus === "FAILED") failedPayments++;

    if (
      paid &&
      isDownloadAvailable(order) &&
      !order.downloadLinkViewedAt &&
      (order.hasDigitalItems || fk === "DIGITAL" || fk === "MIXED")
    ) {
      awaitingClientDownload++;
    }

    if (isPrintPending(order)) printPending++;

    if (
      paid &&
      (order.source === "PRINT_ORDER" || fk === "PRINT" || fk === "MIXED") &&
      (order.status === "CREATED" || order.status === "READY")
    ) {
      printReady++;
    }

    if (isRecentHours(created, RECENT_HOURS, now)) {
      recentOrders++;
      if (paid) recentPaid++;
    }

    if (isVideoOrder(order)) {
      videoOrders++;
      if (daysSince(created, now) <= VIDEO_GROWTH_DAYS) recentVideoOrders++;
    }

    if (paid) {
      if (fk === "DIGITAL") digitalPaid++;
      else if (fk === "PRINT" || order.source === "PRINT_ORDER") printPaid++;
      else if (fk === "MIXED") mixedPaid++;
    }
  }

  return {
    total: orders.length,
    stalePending,
    failedPayments,
    awaitingClientDownload,
    printPending,
    printReady,
    protectedOrders,
    protectedPending,
    recentOrders,
    recentPaid,
    videoOrders,
    recentVideoOrders,
    digitalPaid,
    printPaid,
    mixedPaid,
  };
}

export function computeOperationalHealth(
  metrics: OrdersOperationalMetrics
): OperationalHealth {
  if (metrics.total === 0) {
    return {
      score: 100,
      label: "Excelente",
      tone: "emerald",
      summary: "Sin pedidos todavía — tu panel está listo para operar.",
    };
  }

  let score = 100;

  score -= Math.min(metrics.stalePending * 8, 25);
  score -= Math.min(metrics.failedPayments * 12, 24);
  score -= Math.min(metrics.awaitingClientDownload * 3, 15);
  score -= Math.min(Math.max(metrics.printPending - metrics.printReady, 0) * 4, 20);

  if (metrics.total >= 5 && metrics.recentOrders === 0) {
    score -= 10;
  }

  if (metrics.recentPaid > 0) {
    score += Math.min(metrics.recentPaid * 2, 10);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 85) {
    return {
      score,
      label: "Excelente",
      tone: "emerald",
      summary: "Tu operación va fluida. Seguí el ritmo con las sugerencias de abajo.",
    };
  }
  if (score >= 70) {
    return {
      score,
      label: "Bien",
      tone: "sky",
      summary: "Hay pocas cosas para revisar. Un repaso rápido alcanza.",
    };
  }
  if (score >= 50) {
    return {
      score,
      label: "Atención",
      tone: "amber",
      summary: "Varios pedidos necesitan un empujón. Priorizá lo urgente primero.",
    };
  }
  return {
    score,
    label: "Crítico",
    tone: "rose",
    summary: "Hay fricción operativa. Enfocate en pendientes y entregas hoy.",
  };
}

export function buildOperationalInsights(metrics: OrdersOperationalMetrics): OperationalInsight[] {
  const insights: OperationalInsight[] = [];

  if (metrics.stalePending > 0) {
    insights.push({
      id: "stale-pending",
      icon: "⚠",
      title: `${metrics.stalePending} pendiente${metrics.stalePending === 1 ? "" : "s"} sin cerrar`,
      description: "Llevan más de 3 días esperando pago o acción.",
      tone: "warning",
      filter: "PENDING",
    });
  }

  if (metrics.awaitingClientDownload > 0) {
    insights.push({
      id: "awaiting-download",
      icon: "⬇",
      title: `${metrics.awaitingClientDownload} cliente${metrics.awaitingClientDownload === 1 ? "" : "s"} sin descargar`,
      description: "Pagaron pero aún no bajaron sus fotos digitales.",
      tone: "info",
      filter: "DIGITAL",
    });
  }

  if (metrics.printReady > 0) {
    insights.push({
      id: "print-ready",
      icon: "🖨",
      title: `${metrics.printReady} impresión${metrics.printReady === 1 ? "" : "es"} lista${metrics.printReady === 1 ? "" : "s"}`,
      description: "Podés exportar o preparar la carpeta para imprimir.",
      tone: "positive",
      filter: "PRINT",
    });
  }

  if (metrics.printPending > 0 && metrics.printReady === 0) {
    insights.push({
      id: "print-pending",
      icon: "📦",
      title: `${metrics.printPending} entrega${metrics.printPending === 1 ? "" : "s"} de impresión activa${metrics.printPending === 1 ? "" : "s"}`,
      description: "Seguí el estado hasta completar la entrega.",
      tone: "neutral",
      filter: "PRINT",
    });
  }

  if (metrics.recentVideoOrders > 0) {
    insights.push({
      id: "video-growth",
      icon: "🎥",
      title: "Actividad en videos",
      description: `${metrics.recentVideoOrders} pedido${metrics.recentVideoOrders === 1 ? "" : "s"} de video en las últimas 2 semanas.`,
      tone: "violet",
      filter: "VIDEO",
    });
  }

  const paidTotal = metrics.digitalPaid + metrics.printPaid + metrics.mixedPaid;
  if (paidTotal >= 3 && metrics.digitalPaid / paidTotal >= 0.6) {
    insights.push({
      id: "digital-dominant",
      icon: "💫",
      title: "Ventas digitales predominantes",
      description: "La mayoría de tus pedidos pagos son digitales o mixtos con digital.",
      tone: "positive",
      filter: "DIGITAL",
    });
  }

  if (metrics.protectedOrders > 0) {
    insights.push({
      id: "protected",
      icon: "🔒",
      title: `${metrics.protectedOrders} pedido${metrics.protectedOrders === 1 ? "" : "s"} protegido${metrics.protectedOrders === 1 ? "" : "s"}`,
      description:
        metrics.protectedPending > 0
          ? "Datos del cliente ocultos hasta acreditar el pago."
          : "Incluye pedidos con datos sensibles enmascarados.",
      tone: "neutral",
      filter: "PENDING",
    });
  }

  if (metrics.recentPaid > 0) {
    insights.push({
      id: "recent-activity",
      icon: "✨",
      title: "Buen ritmo de ventas",
      description: `${metrics.recentPaid} pago${metrics.recentPaid === 1 ? "" : "s"} acreditado${metrics.recentPaid === 1 ? "" : "s"} en los últimos 3 días.`,
      tone: "positive",
      filter: "PAID",
    });
  }

  if (metrics.failedPayments > 0) {
    insights.push({
      id: "failed",
      icon: "⛔",
      title: `${metrics.failedPayments} pago${metrics.failedPayments === 1 ? "" : "s"} fallido${metrics.failedPayments === 1 ? "" : "s"}`,
      description: "Conviene dar seguimiento antes de perder la venta.",
      tone: "warning",
      filter: "PENDING",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "all-clear",
      icon: "✓",
      title: "Operación al día",
      description: "No detectamos alertas importantes en este momento.",
      tone: "positive",
      filter: "ALL",
    });
  }

  return insights.slice(0, 6);
}

export function buildOperationalRecommendations(
  metrics: OrdersOperationalMetrics
): OperationalRecommendation[] {
  const recs: OperationalRecommendation[] = [];

  if (metrics.awaitingClientDownload > 0) {
    recs.push({
      id: "remind-download",
      icon: "💬",
      title: "Enviar recordatorio de descarga",
      description: `${metrics.awaitingClientDownload} cliente${metrics.awaitingClientDownload === 1 ? "" : "s"} con fotos listas sin bajar.`,
      ctaLabel: "Ver digitales",
      filter: "DIGITAL",
    });
  }

  if (metrics.stalePending > 0) {
    recs.push({
      id: "contact-pending",
      icon: "📞",
      title: "Contactar pendientes viejos",
      description: "Un mensaje amable puede destrabar pagos que quedaron colgados.",
      ctaLabel: "Ver pendientes",
      filter: "PENDING",
    });
  }

  if (metrics.printReady > 0) {
    recs.push({
      id: "export-print",
      icon: "📤",
      title: "Exportar impresiones listas",
      description: `${metrics.printReady} carpeta${metrics.printReady === 1 ? "" : "s"} preparada${metrics.printReady === 1 ? "" : "s"} para producción.`,
      ctaLabel: "Ver impresión",
      filter: "PRINT",
    });
  }

  if (metrics.printPending > metrics.printReady && metrics.printPending > 0) {
    recs.push({
      id: "complete-deliveries",
      icon: "✅",
      title: "Cerrar entregas pendientes",
      description: "Actualizá el estado cuando el cliente retira o recibe.",
      ctaLabel: "Gestionar entregas",
      filter: "PRINT",
    });
  }

  if (metrics.failedPayments > 0) {
    recs.push({
      id: "follow-failed",
      icon: "🔄",
      title: "Revisar pagos fallidos",
      description: "Ofrecé ayuda para completar el checkout.",
      ctaLabel: "Ver fallidos",
      filter: "PENDING",
    });
  }

  if (metrics.recentVideoOrders > 0) {
    recs.push({
      id: "review-video",
      icon: "🎬",
      title: "Revisar pedidos de video",
      description: "Hay demanda reciente — asegurate de cumplir plazos.",
      ctaLabel: "Ver videos",
      filter: "VIDEO",
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "keep-momentum",
      icon: "🚀",
      title: "Seguí el momentum",
      description: "Todo tranquilo. Revisá pedidos recientes por si hay novedades.",
      ctaLabel: "Ver todos",
      filter: "ALL",
    });
  }

  return recs.slice(0, 4);
}

export const INSIGHT_TONE_CLASSES: Record<OperationalInsightTone, string> = {
  positive: "bg-emerald-50 text-emerald-800 border-emerald-100",
  neutral: "bg-gray-50 text-gray-700 border-gray-100",
  warning: "bg-amber-50 text-amber-900 border-amber-100",
  info: "bg-sky-50 text-sky-800 border-sky-100",
  violet: "bg-violet-50 text-violet-800 border-violet-100",
};

export const HEALTH_TONE_CLASSES: Record<OperationalHealth["tone"], { ring: string; bar: string; text: string }> = {
  emerald: { ring: "text-emerald-500", bar: "bg-emerald-500", text: "text-emerald-700" },
  sky: { ring: "text-sky-500", bar: "bg-sky-500", text: "text-sky-700" },
  amber: { ring: "text-amber-500", bar: "bg-amber-500", text: "text-amber-700" },
  rose: { ring: "text-rose-500", bar: "bg-rose-500", text: "text-rose-700" },
};
