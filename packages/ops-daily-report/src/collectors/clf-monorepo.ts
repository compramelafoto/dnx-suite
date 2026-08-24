import type { ReportAlert } from "../contracts/alert";
import { buildMetric } from "../contracts/metric";
import type { ClfSalesPort, PaidOrderRow } from "../contracts/ports";
import type { ReportTable } from "../contracts/snapshot";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DateRange, DayWindow } from "../window/day-window";

const SECTION_KEY = "clf-monorepo";
const SECTION_TITLE = "ComprameLaFoto";
const RANKING_SIZE = 5;
/** Por debajo de este cociente contra el promedio semanal se avisa. */
const REVENUE_DROP_THRESHOLD = 0.5;

export type ClfMonorepoOptions = {
  /** Base pública de la app, para armar los enlaces del correo. */
  adminBaseUrl: string;
};

type OrdersSummary = {
  count: number;
  revenueArs: number;
  averageTicketArs: number;
  redemptionCount: number;
  preventaCount: number;
};

function summarize(orders: PaidOrderRow[]): OrdersSummary {
  const revenueArs = orders.reduce((total, row) => total + row.totalArs, 0);
  return {
    count: orders.length,
    revenueArs,
    averageTicketArs: orders.length === 0 ? 0 : Math.round(revenueArs / orders.length),
    redemptionCount: orders.filter((row) => row.origin === "PACK_REDEMPTION").length,
    preventaCount: orders.filter((row) => row.origin === "PREVENTA_PACK").length,
  };
}

type RankedEntity = {
  label: string;
  orders: number;
  revenueArs: number;
  items: number;
};

function rankBy(
  orders: PaidOrderRow[],
  keyOf: (row: PaidOrderRow) => string,
  labelOf: (row: PaidOrderRow) => string,
): RankedEntity[] {
  const buckets = new Map<string, RankedEntity>();

  for (const row of orders) {
    const key = keyOf(row);
    const current = buckets.get(key) ?? { label: labelOf(row), orders: 0, revenueArs: 0, items: 0 };
    current.orders += 1;
    current.revenueArs += row.totalArs;
    current.items += row.itemCount;
    buckets.set(key, current);
  }

  return [...buckets.values()]
    .sort(
      (left, right) => right.revenueArs - left.revenueArs || left.label.localeCompare(right.label),
    )
    .slice(0, RANKING_SIZE);
}

function rankingTable(title: string, entities: RankedEntity[], emptyMessage: string): ReportTable {
  return {
    title,
    columns: ["Nombre", "Pedidos", "Facturación (ARS)", "Fotos"],
    rows: entities.map((entity) => [entity.label, entity.orders, entity.revenueArs, entity.items]),
    emptyMessage,
  };
}

async function loadRange(port: ClfSalesPort, range: DateRange): Promise<PaidOrderRow[]> {
  return port.paidOrders(range);
}

export function createClfMonorepoCollector(
  port: ClfSalesPort,
  window: DayWindow,
  options: ClfMonorepoOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [currentOrders, previousOrders, trailingOrders] = await Promise.all([
        loadRange(port, window.current),
        loadRange(port, window.previous),
        loadRange(port, window.trailingSevenDays),
      ]);

      const [pendingOrders, newUsers, newAlbums, uploadedPhotos] = await Promise.all([
        port.countPendingOrders(window.current),
        port.countNewUsers(window.current),
        port.countNewAlbums(window.current),
        port.countUploadedPhotos(window.current),
      ]);

      const [previousUsers, previousAlbums, previousPhotos] = await Promise.all([
        port.countNewUsers(window.previous),
        port.countNewAlbums(window.previous),
        port.countUploadedPhotos(window.previous),
      ]);

      const current = summarize(currentOrders);
      const previous = summarize(previousOrders);
      const trailing = summarize(trailingOrders);
      const trailingDailyRevenue = trailing.revenueArs / 7;
      const trailingDailyOrders = trailing.count / 7;

      const alerts: ReportAlert[] = [];
      const revenueDropped =
        trailingDailyRevenue > 0 &&
        current.revenueArs < trailingDailyRevenue * REVENUE_DROP_THRESHOLD;

      if (revenueDropped) {
        alerts.push({
          id: `${SECTION_KEY}:revenue-drop`,
          platform: "clf-monorepo",
          title: "Caída fuerte de facturación",
          detail:
            `Se facturaron ${current.revenueArs} ARS, menos de la mitad del promedio ` +
            `diario de la última semana (${Math.round(trailingDailyRevenue)} ARS). ` +
            "Conviene revisar que el checkout y los pagos estén funcionando.",
          severity: "medium",
          urgency: "today",
          affectedCount: null,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/pedidos`,
        });
      }

      return {
        alerts,
        section: {
          key: SECTION_KEY,
          title: SECTION_TITLE,
          status: "ok",
          error: null,
          groups: [
            {
              title: "Ventas",
              metrics: [
                buildMetric({
                  key: "paidOrders",
                  label: "Pedidos pagados",
                  value: current.count,
                  format: "count",
                  previousValue: previous.count,
                  sevenDayAverage: trailingDailyOrders,
                }),
                buildMetric({
                  key: "revenueArs",
                  label: "Facturación",
                  value: current.revenueArs,
                  format: "currencyArs",
                  previousValue: previous.revenueArs,
                  sevenDayAverage: trailingDailyRevenue,
                }),
                buildMetric({
                  key: "averageTicketArs",
                  label: "Ticket promedio",
                  value: current.averageTicketArs,
                  format: "currencyArs",
                  previousValue: previous.averageTicketArs,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "redemptionOrders",
                  label: "Pedidos por canje de pack",
                  value: current.redemptionCount,
                  format: "count",
                  previousValue: previous.redemptionCount,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "preventaOrders",
                  label: "Pedidos de preventa",
                  value: current.preventaCount,
                  format: "count",
                  previousValue: previous.preventaCount,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "pendingOrders",
                  label: "Pedidos pendientes de pago",
                  value: pendingOrders,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                  hint: "Iniciados y todavía sin pago acreditado.",
                }),
              ],
            },
            {
              title: "Actividad",
              metrics: [
                buildMetric({
                  key: "newUsers",
                  label: "Usuarios nuevos",
                  value: newUsers,
                  format: "count",
                  previousValue: previousUsers,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "newAlbums",
                  label: "Álbumes creados",
                  value: newAlbums,
                  format: "count",
                  previousValue: previousAlbums,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "uploadedPhotos",
                  label: "Fotos subidas",
                  value: uploadedPhotos,
                  format: "count",
                  previousValue: previousPhotos,
                  sevenDayAverage: null,
                }),
              ],
            },
          ],
          tables: [
            rankingTable(
              "Top fotógrafos por facturación",
              rankBy(
                currentOrders,
                (row) => String(row.photographerId),
                (row) => row.photographerName,
              ),
              "Sin ventas en el día.",
            ),
            rankingTable(
              "Top álbumes por facturación",
              rankBy(
                currentOrders,
                (row) => String(row.albumId),
                (row) => row.albumTitle,
              ),
              "Sin ventas en el día.",
            ),
          ],
        },
      };
    },
  };
}
