/**
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/components/fotografo/orders/orders-analytics-filters.test.ts
 */
import assert from "node:assert/strict";
import {
  arDayKey,
  filterOrdersForAnalytics,
  listAnalyticsAlbums,
  monthsBetween,
  orderMoney,
  resolveAnalyticsRange,
  type AnalyticsOrderLike,
} from "./orders-analytics-filters";

// 12/11/2026 01:30 UTC = 11/11 22:30 en Argentina.
const now = new Date("2026-11-12T01:30:00Z");
assert.equal(arDayKey(now), "2026-11-11");

assert.deepEqual(resolveAnalyticsRange({ album: "all", period: "7d" }, now), {
  fromDay: "2026-11-05",
  toDay: "2026-11-11",
});
assert.deepEqual(resolveAnalyticsRange({ album: "all", period: "thisMonth" }, now), {
  fromDay: "2026-11-01",
  toDay: "2026-11-11",
});
assert.deepEqual(resolveAnalyticsRange({ album: "all", period: "lastMonth" }, now), {
  fromDay: "2026-10-01",
  toDay: "2026-10-31",
});
assert.deepEqual(
  resolveAnalyticsRange({ album: "all", period: "lastMonth" }, new Date("2026-01-10T15:00:00Z")),
  { fromDay: "2025-12-01", toDay: "2025-12-31" }
);
assert.deepEqual(resolveAnalyticsRange({ album: "all", period: "all" }, now), { fromDay: null, toDay: null });
// Fechas invertidas se acomodan.
assert.deepEqual(
  resolveAnalyticsRange({ album: "all", period: "custom", from: "2026-10-20", to: "2026-10-01" }, now),
  { fromDay: "2026-10-01", toDay: "2026-10-20" }
);

const orders: AnalyticsOrderLike[] = [
  // 31/10 23:30 en Argentina (ya 1/11 en UTC): cuenta para octubre.
  { createdAtIso: "2026-11-01T02:30:00Z", source: "ALBUM_ORDER", albumId: 1, albumTitle: "Boda", total: 11500, netAmount: 10000, platformFeeAmount: 1500 },
  { createdAtIso: "2026-11-10T15:00:00Z", source: "ALBUM_ORDER", albumId: 2, albumTitle: "Acto", total: 2300, netAmount: 2000, platformFeeAmount: 300 },
  { createdAtIso: "2026-11-10T15:00:00Z", source: "PRINT_ORDER", albumId: null, total: 9200, netAmount: 8000, platformFeeAmount: 1200 },
  { createdAtIso: "2026-11-10T15:00:00Z", source: "ALBUM_ORDER", albumId: 1, albumTitle: "Boda", total: 0, isDemo: true },
];

const oct = filterOrdersForAnalytics(orders, { album: "all", period: "lastMonth" }, now);
assert.equal(oct.length, 1, "el pedido de las 23:30 del 31/10 es de octubre");

const boda = filterOrdersForAnalytics(orders, { album: 1, period: "all" }, now);
assert.equal(boda.length, 1, "demo afuera");
const prints = filterOrdersForAnalytics(orders, { album: "prints", period: "all" }, now);
assert.equal(prints.length, 1);

const { albums, hasDirectPrints } = listAnalyticsAlbums(orders);
assert.deepEqual(albums.map((a) => a.title), ["Acto", "Boda"]);
assert.equal(hasDirectPrints, true);

assert.deepEqual(orderMoney(orders[0]), { net: 10000, fee: 1500, netPlusFee: 11500 });
assert.deepEqual(orderMoney(orders[3]), { net: 0, fee: 0, netPlusFee: 0 });
// Sin desglose del servidor: neto = lo recibido, comisión 0.
assert.deepEqual(orderMoney({ total: 5000, photographerReceivedAmount: 5000 }), { net: 5000, fee: 0, netPlusFee: 5000 });

assert.deepEqual(monthsBetween("2025-11-20", "2026-02-03"), ["2025-11", "2025-12", "2026-01", "2026-02"]);

console.log("orders-analytics-filters: OK");
