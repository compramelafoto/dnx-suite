import type { ReportAlert } from "../contracts/alert";
import { buildMetric } from "../contracts/metric";
import type {
  ClickatonPort,
  ClickatonRegistrationRow,
  ClickatonStoreOrderRow,
} from "../contracts/ports";
import type { ReportTable } from "../contracts/snapshot";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DayWindow } from "../window/day-window";

const SECTION_KEY = "clickaton";
const SECTION_TITLE = "Clickatón";
const RANKING_SIZE = 5;

/** Una inscripción solo cuenta como acceso vendido cuando está confirmada. */
const CONFIRMED = "CONFIRMED";
const PENDING = "PENDING_PAYMENT";
/** Se quedó sin pagar dentro del plazo: es plata que se perdió. */
const EXPIRED_STATUSES = new Set(["EXPIRED", "CANCELLED"]);

export type ClickatonOptions = {
  adminBaseUrl: string;
};

type RegistrationsSummary = {
  confirmed: number;
  pending: number;
  expired: number;
  revenueArs: number;
};

function summarize(rows: ClickatonRegistrationRow[]): RegistrationsSummary {
  let confirmed = 0;
  let pending = 0;
  let expired = 0;
  let revenueArs = 0;

  for (const row of rows) {
    if (row.status === CONFIRMED) {
      confirmed += 1;
      revenueArs += row.totalArs;
      continue;
    }
    if (row.status === PENDING) {
      pending += 1;
      continue;
    }
    if (EXPIRED_STATUSES.has(row.status)) expired += 1;
  }

  return { confirmed, pending, expired, revenueArs };
}

type EditionRank = {
  name: string;
  accesses: number;
  revenueArs: number;
  pending: number;
};

/**
 * Ranking de ediciones por accesos vendidos.
 *
 * Ordena por cantidad de accesos y no por plata: la pregunta que responde es
 * "qué edición vendió más entradas", y una edición cara con pocas ventas no
 * debería aparecer arriba de una que llenó el cupo.
 */
function rankEditions(rows: ClickatonRegistrationRow[]): EditionRank[] {
  const buckets = new Map<string, EditionRank>();

  for (const row of rows) {
    const current = buckets.get(row.editionId) ?? {
      name: row.editionName,
      accesses: 0,
      revenueArs: 0,
      pending: 0,
    };

    if (row.status === CONFIRMED) {
      current.accesses += 1;
      current.revenueArs += row.totalArs;
    } else if (row.status === PENDING) {
      current.pending += 1;
    }

    buckets.set(row.editionId, current);
  }

  return [...buckets.values()]
    .filter((edition) => edition.accesses > 0 || edition.pending > 0)
    .sort(
      (left, right) =>
        right.accesses - left.accesses ||
        right.revenueArs - left.revenueArs ||
        left.name.localeCompare(right.name),
    )
    .slice(0, RANKING_SIZE);
}

type ProductRank = {
  name: string;
  quantity: number;
  revenueArs: number;
};

function rankProducts(orders: ClickatonStoreOrderRow[]): ProductRank[] {
  const buckets = new Map<string, ProductRank>();

  for (const order of orders) {
    for (const item of order.items) {
      const current = buckets.get(item.productName) ?? {
        name: item.productName,
        quantity: 0,
        revenueArs: 0,
      };
      current.quantity += item.quantity;
      current.revenueArs += item.subtotalArs;
      buckets.set(item.productName, current);
    }
  }

  return [...buckets.values()]
    .sort(
      (left, right) =>
        right.quantity - left.quantity ||
        right.revenueArs - left.revenueArs ||
        left.name.localeCompare(right.name),
    )
    .slice(0, RANKING_SIZE);
}

function editionsTable(editions: EditionRank[]): ReportTable {
  return {
    title: "Ranking de ediciones por accesos vendidos",
    columns: ["Edición", "Accesos", "Facturación (ARS)", "Pendientes de pago"],
    rows: editions.map((edition) => [
      edition.name,
      edition.accesses,
      edition.revenueArs,
      edition.pending,
    ]),
    emptyMessage: "Sin inscripciones en el día.",
  };
}

function productsTable(products: ProductRank[]): ReportTable {
  return {
    title: "Top productos de tienda",
    columns: ["Producto", "Unidades", "Facturación (ARS)"],
    rows: products.map((product) => [product.name, product.quantity, product.revenueArs]),
    emptyMessage: "Sin ventas de tienda en el día.",
  };
}

export function createClickatonCollector(
  port: ClickatonPort,
  window: DayWindow,
  options: ClickatonOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [currentRows, previousRows, currentOrders, previousOrders, activity, previousActivity] =
        await Promise.all([
          port.registrations(window.current),
          port.registrations(window.previous),
          port.storeOrders(window.current),
          port.storeOrders(window.previous),
          port.activity(window.current),
          port.activity(window.previous),
        ]);

      const current = summarize(currentRows);
      const previous = summarize(previousRows);

      const storeRevenueArs = currentOrders.reduce((total, order) => total + order.totalArs, 0);
      const previousStoreRevenue = previousOrders.reduce(
        (total, order) => total + order.totalArs,
        0,
      );

      const rejectedSubmissions = activity.photoSubmissionsByStatus.REJECTED ?? 0;

      const alerts: ReportAlert[] = [];

      if (current.expired > 0) {
        alerts.push({
          id: `${SECTION_KEY}:expired-registrations`,
          platform: "clickaton",
          title: "Inscripciones que se cayeron sin pagar",
          detail:
            `${current.expired} inscripciones vencieron o se cancelaron sin completar el pago. ` +
            "Son cupos que se liberaron y ventas que no se concretaron.",
          severity: "medium",
          urgency: "today",
          affectedCount: current.expired,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/inscripciones`,
        });
      }

      if (rejectedSubmissions > 0) {
        alerts.push({
          id: `${SECTION_KEY}:rejected-submissions`,
          platform: "clickaton",
          title: "Fotos rechazadas en la admisión técnica",
          detail:
            `${rejectedSubmissions} fotos enviadas por participantes no pasaron la validación. ` +
            "Conviene revisar si el motivo es real o si hay algo mal configurado en la edición.",
          severity: "low",
          urgency: "thisWeek",
          affectedCount: rejectedSubmissions,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/fotos`,
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
              title: "Accesos e inscripciones",
              metrics: [
                buildMetric({
                  key: "confirmedRegistrations",
                  label: "Accesos vendidos",
                  value: current.confirmed,
                  format: "count",
                  previousValue: previous.confirmed,
                  sevenDayAverage: null,
                  hint: "Inscripciones confirmadas con el pago acreditado.",
                }),
                buildMetric({
                  key: "registrationRevenueArs",
                  label: "Facturación por inscripciones",
                  value: current.revenueArs,
                  format: "currencyArs",
                  previousValue: previous.revenueArs,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "pendingRegistrations",
                  label: "Inscripciones pendientes de pago",
                  value: current.pending,
                  format: "count",
                  previousValue: previous.pending,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "expiredRegistrations",
                  label: "Inscripciones caídas",
                  value: current.expired,
                  format: "count",
                  previousValue: previous.expired,
                  sevenDayAverage: null,
                  hint: "Vencidas o canceladas sin completar el pago.",
                }),
              ],
            },
            {
              title: "Tienda",
              metrics: [
                buildMetric({
                  key: "storeOrders",
                  label: "Pedidos de tienda",
                  value: currentOrders.length,
                  format: "count",
                  previousValue: previousOrders.length,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "storeRevenueArs",
                  label: "Facturación de tienda",
                  value: storeRevenueArs,
                  format: "currencyArs",
                  previousValue: previousStoreRevenue,
                  sevenDayAverage: null,
                }),
              ],
            },
            {
              title: "Actividad del evento",
              metrics: [
                buildMetric({
                  key: "photoSubmissions",
                  label: "Fotos enviadas",
                  value: activity.photoSubmissions,
                  format: "count",
                  previousValue: previousActivity.photoSubmissions,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "rejectedSubmissions",
                  label: "Fotos rechazadas",
                  value: rejectedSubmissions,
                  format: "count",
                  previousValue: previousActivity.photoSubmissionsByStatus.REJECTED ?? 0,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "checkIns",
                  label: "Acreditaciones",
                  value: activity.checkIns,
                  format: "count",
                  previousValue: previousActivity.checkIns,
                  sevenDayAverage: null,
                }),
              ],
            },
          ],
          tables: [editionsTable(rankEditions(currentRows)), productsTable(rankProducts(currentOrders))],
        },
      };
    },
  };
}
