import assert from "node:assert/strict";
import { test } from "node:test";

import type { ClfSalesPort, PaidOrderRow } from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createClfMonorepoCollector } from "./clf-monorepo";

const WINDOW = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));

function order(overrides: Partial<PaidOrderRow> & { orderId: number }): PaidOrderRow {
  return {
    totalArs: 10_000,
    photographerId: 1,
    photographerName: "Ana Pérez",
    albumId: 100,
    albumTitle: "Torneo Apertura",
    itemCount: 2,
    origin: "STANDARD_CHECKOUT",
    ...overrides,
  };
}

function stubPort(overrides: Partial<ClfSalesPort> = {}): ClfSalesPort {
  return {
    async paidOrders() {
      return [];
    },
    async countPendingOrders() {
      return 0;
    },
    async countNewUsers() {
      return 0;
    },
    async countNewAlbums() {
      return 0;
    },
    async countUploadedPhotos() {
      return 0;
    },
    ...overrides,
  };
}

type CollectorRunResult = Awaited<
  ReturnType<ReturnType<typeof createClfMonorepoCollector>["run"]>
>;

function metricValue(result: CollectorRunResult, key: string): number {
  for (const group of result.section.groups) {
    for (const metric of group.metrics) {
      if (metric.key === key) return metric.value;
    }
  }
  throw new Error(`No se encontró la métrica ${key}`);
}

test("suma la facturación del día en pesos enteros", async () => {
  const collector = createClfMonorepoCollector(
    stubPort({
      async paidOrders(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [order({ orderId: 1, totalArs: 15_000 }), order({ orderId: 2, totalArs: 5_000 })];
      },
    }),
    WINDOW,
    { adminBaseUrl: "https://compramelafoto.com" },
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "paidOrders"), 2);
  assert.equal(metricValue(result, "revenueArs"), 20_000);
  assert.equal(metricValue(result, "averageTicketArs"), 10_000);
});

test("arma el ranking de fotógrafos por monto vendido", async () => {
  const collector = createClfMonorepoCollector(
    stubPort({
      async paidOrders(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [
          order({ orderId: 1, photographerId: 1, photographerName: "Ana Pérez", totalArs: 5_000 }),
          order({ orderId: 2, photographerId: 2, photographerName: "Beto Ruiz", totalArs: 30_000 }),
          order({ orderId: 3, photographerId: 1, photographerName: "Ana Pérez", totalArs: 4_000 }),
        ];
      },
    }),
    WINDOW,
    { adminBaseUrl: "https://compramelafoto.com" },
  );

  const result = await collector.run();
  const ranking = result.section.tables.find((table) => table.title.includes("fotógrafos"));

  assert.ok(ranking);
  assert.equal(ranking.rows[0]![0], "Beto Ruiz");
  assert.equal(ranking.rows[0]![2], 30_000);
  assert.equal(ranking.rows[1]![0], "Ana Pérez");
  assert.equal(ranking.rows[1]![1], 2);
  assert.equal(ranking.rows[1]![2], 9_000);
});

test("calcula la variación contra el día anterior", async () => {
  const collector = createClfMonorepoCollector(
    stubPort({
      async paidOrders(range) {
        if (range.start.getTime() === WINDOW.current.start.getTime()) {
          return [order({ orderId: 1 }), order({ orderId: 2 })];
        }
        if (range.start.getTime() === WINDOW.previous.start.getTime()) {
          return [order({ orderId: 3 })];
        }
        return [];
      },
    }),
    WINDOW,
    { adminBaseUrl: "https://compramelafoto.com" },
  );

  const result = await collector.run();
  const metric = result.section.groups
    .flatMap((group) => group.metrics)
    .find((item) => item.key === "paidOrders");

  assert.equal(metric?.previousValue, 1);
  assert.equal(metric?.changeRatio, 1);
});

test("un día sin ventas no rompe nada y deja la tabla con mensaje vacío", async () => {
  const collector = createClfMonorepoCollector(stubPort(), WINDOW, {
    adminBaseUrl: "https://compramelafoto.com",
  });

  const result = await collector.run();

  assert.equal(metricValue(result, "paidOrders"), 0);
  assert.equal(metricValue(result, "averageTicketArs"), 0);
  const ranking = result.section.tables.find((table) => table.title.includes("fotógrafos"));
  assert.equal(ranking?.rows.length, 0);
  assert.match(ranking?.emptyMessage ?? "", /sin ventas/i);
});

test("separa los pedidos de canje de los de preventa", async () => {
  const collector = createClfMonorepoCollector(
    stubPort({
      async paidOrders(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [
          order({ orderId: 1, origin: "PACK_REDEMPTION" }),
          order({ orderId: 2, origin: "PREVENTA_PACK" }),
          order({ orderId: 3, origin: "PREVENTA_PACK" }),
          order({ orderId: 4, origin: "STANDARD_CHECKOUT" }),
        ];
      },
    }),
    WINDOW,
    { adminBaseUrl: "https://compramelafoto.com" },
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "redemptionOrders"), 1);
  assert.equal(metricValue(result, "preventaOrders"), 2);
});

test("avisa cuando las ventas caen más de la mitad contra el promedio de la semana", async () => {
  const collector = createClfMonorepoCollector(
    stubPort({
      async paidOrders(range) {
        if (range.start.getTime() === WINDOW.current.start.getTime()) {
          return [order({ orderId: 1, totalArs: 1_000 })];
        }
        if (range.start.getTime() === WINDOW.trailingSevenDays.start.getTime()) {
          // 70.000 en siete días = 10.000 por día de promedio.
          return Array.from({ length: 7 }, (_, index) =>
            order({ orderId: 100 + index, totalArs: 10_000 }),
          );
        }
        return [];
      },
    }),
    WINDOW,
    { adminBaseUrl: "https://compramelafoto.com" },
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "clf-monorepo:revenue-drop");

  assert.ok(alert, "esperaba una alerta de caída de facturación");
  assert.equal(alert.severity, "medium");
  assert.equal(alert.urgency, "today");
});

test("no avisa de caída cuando la semana previa tampoco tuvo ventas", async () => {
  const collector = createClfMonorepoCollector(stubPort(), WINDOW, {
    adminBaseUrl: "https://compramelafoto.com",
  });

  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "clf-monorepo:revenue-drop"),
    undefined,
  );
});
