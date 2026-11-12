/**
 * Filtros de la pantalla de estadísticas del fotógrafo (álbum + período) y montos de cada pedido.
 *
 * Lógica pura, sin imports con "@/": se prueba con
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/components/fotografo/orders/orders-analytics-filters.test.ts
 *
 * Los días se cuentan en hora argentina, no en la del navegador.
 */

const AR_TZ = "America/Argentina/Buenos_Aires";
/** Argentina no tiene horario de verano: el desfase es fijo. */
const AR_OFFSET = "-03:00";

export type AnalyticsPeriod = "7d" | "30d" | "thisMonth" | "lastMonth" | "thisYear" | "all" | "custom";

export const ANALYTICS_PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "all", label: "Todo" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "thisMonth", label: "Este mes" },
  { value: "lastMonth", label: "Mes anterior" },
  { value: "thisYear", label: "Este año" },
  { value: "custom", label: "Elegir fechas" },
];

/** Valor del selector de álbum: "all", "prints" (impresiones directas, sin álbum) o el id del álbum. */
export type AnalyticsAlbumFilter = "all" | "prints" | number;

export type AnalyticsFilters = {
  album: AnalyticsAlbumFilter;
  period: AnalyticsPeriod;
  /** yyyy-mm-dd (sólo con period "custom"). */
  from?: string | null;
  to?: string | null;
};

/** Lo mínimo de un pedido que usan los filtros y las sumas. */
export type AnalyticsOrderLike = {
  createdAtIso?: string | null;
  source?: "PRINT_ORDER" | "ALBUM_ORDER";
  albumId?: number | null;
  albumTitle?: string | null;
  total: number;
  netAmount?: number;
  platformFeeAmount?: number;
  photographerReceivedAmount?: number;
  isDemo?: boolean;
};

/** yyyy-mm-dd del instante en hora argentina. */
export function arDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Inicio (00:00 en Argentina) del día yyyy-mm-dd. */
export function arDayStart(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00${AR_OFFSET}`);
}

function addDays(dayKey: string, days: number): string {
  const d = arDayStart(dayKey);
  d.setUTCDate(d.getUTCDate() + days);
  return arDayKey(new Date(d.getTime() + 12 * 3600 * 1000));
}

export type AnalyticsRange = {
  /** Día inicial inclusive (yyyy-mm-dd) o null si no hay límite. */
  fromDay: string | null;
  /** Día final inclusive (yyyy-mm-dd) o null si no hay límite. */
  toDay: string | null;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Traduce el período elegido a días concretos en hora argentina. */
export function resolveAnalyticsRange(filters: AnalyticsFilters, now = new Date()): AnalyticsRange {
  const today = arDayKey(now);
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (filters.period) {
    case "7d":
      return { fromDay: addDays(today, -6), toDay: today };
    case "30d":
      return { fromDay: addDays(today, -29), toDay: today };
    case "thisMonth":
      return { fromDay: `${y}-${pad(m)}-01`, toDay: today };
    case "lastMonth": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      const firstThis = `${y}-${pad(m)}-01`;
      return { fromDay: `${py}-${pad(pm)}-01`, toDay: addDays(firstThis, -1) };
    }
    case "thisYear":
      return { fromDay: `${y}-01-01`, toDay: today };
    case "custom": {
      let fromDay = filters.from && DAY_RE.test(filters.from) ? filters.from : null;
      let toDay = filters.to && DAY_RE.test(filters.to) ? filters.to : null;
      if (fromDay && toDay && fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
      return { fromDay, toDay };
    }
    default:
      return { fromDay: null, toDay: null };
  }
}

function orderDay(order: AnalyticsOrderLike): string | null {
  if (!order.createdAtIso) return null;
  const d = new Date(order.createdAtIso);
  return Number.isNaN(d.getTime()) ? null : arDayKey(d);
}

/** Aplica álbum y período. Los pedidos de prueba (demo) nunca entran. */
export function filterOrdersForAnalytics<T extends AnalyticsOrderLike>(
  orders: T[],
  filters: AnalyticsFilters,
  now = new Date()
): T[] {
  const { fromDay, toDay } = resolveAnalyticsRange(filters, now);
  return orders.filter((o) => {
    if (o.isDemo) return false;
    if (filters.album === "prints") {
      if (o.source !== "PRINT_ORDER") return false;
    } else if (filters.album !== "all") {
      if (o.albumId !== filters.album) return false;
    }
    if (fromDay || toDay) {
      const day = orderDay(o);
      if (!day) return false;
      if (fromDay && day < fromDay) return false;
      if (toDay && day > toDay) return false;
    }
    return true;
  });
}

export type AnalyticsAlbumOption = { id: number; title: string; count: number };

/** Álbumes con pedidos, ordenados por título, para el selector. */
export function listAnalyticsAlbums(orders: AnalyticsOrderLike[]): {
  albums: AnalyticsAlbumOption[];
  hasDirectPrints: boolean;
} {
  const map = new Map<number, AnalyticsAlbumOption>();
  let hasDirectPrints = false;
  for (const o of orders) {
    if (o.isDemo) continue;
    if (o.source === "PRINT_ORDER") hasDirectPrints = true;
    if (o.albumId == null) continue;
    const prev = map.get(o.albumId);
    if (prev) prev.count += 1;
    else map.set(o.albumId, { id: o.albumId, title: o.albumTitle?.trim() || `Álbum #${o.albumId}`, count: 1 });
  }
  const albums = [...map.values()].sort((a, b) => a.title.localeCompare(b.title, "es"));
  return { albums, hasDirectPrints };
}

export type OrderMoney = {
  /** Lo que le queda al fotógrafo, antes de los recargos de Mercado Pago. */
  net: number;
  /** Comisión de la plataforma. */
  fee: number;
  /** Neto + comisión. */
  netPlusFee: number;
};

/**
 * Montos de un pedido pago. Si el servidor no mandó el desglose (pantallas viejas),
 * se toma lo recibido como neto y la comisión como 0.
 */
export function orderMoney(order: AnalyticsOrderLike): OrderMoney {
  if (order.isDemo) return { net: 0, fee: 0, netPlusFee: 0 };
  const fee = Math.max(0, Number(order.platformFeeAmount ?? 0)) || 0;
  const rawNet =
    order.netAmount ?? order.photographerReceivedAmount ?? Math.max(0, (order.total ?? 0) - fee);
  const net = Math.max(0, Number(rawNet) || 0);
  return { net, fee, netPlusFee: net + fee };
}

/** Cantidad de días del rango (inclusive), o null si no tiene límites. */
export function rangeLengthDays(range: AnalyticsRange): number | null {
  if (!range.fromDay || !range.toDay) return null;
  const ms = arDayStart(range.toDay).getTime() - arDayStart(range.fromDay).getTime();
  return Math.round(ms / 86400000) + 1;
}

/** Lista de días yyyy-mm-dd entre dos días (inclusive). */
export function daysBetween(fromDay: string, toDay: string): string[] {
  const out: string[] = [];
  let cur = fromDay;
  let guard = 0;
  while (cur <= toDay && guard < 2000) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}

/** Lista de meses yyyy-mm entre dos días (inclusive). */
export function monthsBetween(fromDay: string, toDay: string): string[] {
  const out: string[] = [];
  let [y, m] = fromDay.split("-").map(Number);
  const [ty, tm] = toDay.split("-").map(Number);
  let guard = 0;
  while ((y < ty || (y === ty && m <= tm)) && guard < 600) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard++;
  }
  return out;
}
