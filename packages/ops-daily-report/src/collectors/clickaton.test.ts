import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  ClickatonActivity,
  ClickatonPort,
  ClickatonRegistrationRow,
  ClickatonStoreOrderRow,
} from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createClickatonCollector } from "./clickaton";

const WINDOW = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));
const OPTIONS = { adminBaseUrl: "https://clickaton.com" };

function registration(
  overrides: Partial<ClickatonRegistrationRow> & { registrationId: string },
): ClickatonRegistrationRow {
  return {
    editionId: "ed-1",
    editionName: "Clickatón Rosario 2026",
    ticketTypeName: "General",
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    totalArs: 10_000,
    ...overrides,
  };
}

function emptyActivity(): ClickatonActivity {
  return {
    photoSubmissions: 0,
    photoSubmissionsByStatus: {},
    checkIns: 0,
  };
}

function stubPort(overrides: Partial<ClickatonPort> = {}): ClickatonPort {
  return {
    async registrations() {
      return [];
    },
    async storeOrders() {
      return [];
    },
    async activity() {
      return emptyActivity();
    },
    ...overrides,
  };
}

type RunResult = Awaited<ReturnType<ReturnType<typeof createClickatonCollector>["run"]>>;

function metricValue(result: RunResult, key: string): number {
  for (const group of result.section.groups) {
    for (const metric of group.metrics) {
      if (metric.key === key) return metric.value;
    }
  }
  throw new Error(`No se encontró la métrica ${key}`);
}

test("cuenta solo como accesos vendidos las inscripciones confirmadas", async () => {
  const collector = createClickatonCollector(
    stubPort({
      async registrations(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [
          registration({ registrationId: "a", status: "CONFIRMED" }),
          registration({ registrationId: "b", status: "CONFIRMED" }),
          registration({ registrationId: "c", status: "PENDING_PAYMENT" }),
          registration({ registrationId: "d", status: "CANCELLED" }),
        ];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "confirmedRegistrations"), 2);
  assert.equal(metricValue(result, "pendingRegistrations"), 1);
});

test("la facturación suma solo las inscripciones confirmadas", async () => {
  const collector = createClickatonCollector(
    stubPort({
      async registrations(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [
          registration({ registrationId: "a", status: "CONFIRMED", totalArs: 12_000 }),
          registration({ registrationId: "b", status: "PENDING_PAYMENT", totalArs: 50_000 }),
        ];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "registrationRevenueArs"), 12_000);
});

test("arma el ranking de ediciones por accesos vendidos", async () => {
  const collector = createClickatonCollector(
    stubPort({
      async registrations(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [
          registration({ registrationId: "a", editionId: "ros", editionName: "Rosario", totalArs: 8_000 }),
          registration({ registrationId: "b", editionId: "sfe", editionName: "Santa Fe", totalArs: 5_000 }),
          registration({ registrationId: "c", editionId: "sfe", editionName: "Santa Fe", totalArs: 5_000 }),
          registration({ registrationId: "d", editionId: "sfe", editionName: "Santa Fe", totalArs: 5_000 }),
        ];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const ranking = result.section.tables.find((table) => table.title.includes("ediciones"));

  assert.ok(ranking, "esperaba la tabla de ranking de ediciones");
  // Santa Fe vendió 3 accesos contra 1 de Rosario: manda la cantidad de accesos.
  assert.equal(ranking.rows[0]![0], "Santa Fe");
  assert.equal(ranking.rows[0]![1], 3);
  assert.equal(ranking.rows[0]![2], 15_000);
  assert.equal(ranking.rows[1]![0], "Rosario");
  assert.equal(ranking.rows[1]![1], 1);
});

test("un día sin inscripciones deja la tabla vacía con su mensaje", async () => {
  const collector = createClickatonCollector(stubPort(), WINDOW, OPTIONS);

  const result = await collector.run();
  const ranking = result.section.tables.find((table) => table.title.includes("ediciones"));

  assert.equal(ranking?.rows.length, 0);
  assert.match(ranking?.emptyMessage ?? "", /sin inscripciones/i);
});

test("resume las ventas de la tienda y los productos más vendidos", async () => {
  const orders: ClickatonStoreOrderRow[] = [
    {
      orderId: "o1",
      editionId: "ros",
      editionName: "Rosario",
      totalArs: 20_000,
      items: [
        { productName: "Remera", quantity: 2, subtotalArs: 12_000 },
        { productName: "Gorra", quantity: 1, subtotalArs: 8_000 },
      ],
    },
    {
      orderId: "o2",
      editionId: "ros",
      editionName: "Rosario",
      totalArs: 6_000,
      items: [{ productName: "Remera", quantity: 1, subtotalArs: 6_000 }],
    },
  ];

  const collector = createClickatonCollector(
    stubPort({
      async storeOrders(range) {
        return range.start.getTime() === WINDOW.current.start.getTime() ? orders : [];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "storeOrders"), 2);
  assert.equal(metricValue(result, "storeRevenueArs"), 26_000);

  const productos = result.section.tables.find((table) => table.title.includes("productos"));
  assert.equal(productos?.rows[0]![0], "Remera");
  assert.equal(productos?.rows[0]![1], 3);
  assert.equal(productos?.rows[0]![2], 18_000);
});

test("informa fotos enviadas y acreditaciones", async () => {
  const collector = createClickatonCollector(
    stubPort({
      async activity(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return emptyActivity();
        return {
          photoSubmissions: 120,
          photoSubmissionsByStatus: { APPROVED: 100, REJECTED: 20 },
          checkIns: 45,
        };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "photoSubmissions"), 120);
  assert.equal(metricValue(result, "checkIns"), 45);
});

test("avisa cuando hubo inscripciones que expiraron sin pagar", async () => {
  const collector = createClickatonCollector(
    stubPort({
      async registrations(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [
          registration({ registrationId: "a", status: "EXPIRED" }),
          registration({ registrationId: "b", status: "EXPIRED" }),
          registration({ registrationId: "c", status: "CONFIRMED" }),
        ];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "clickaton:expired-registrations");

  assert.ok(alert, "esperaba alerta por inscripciones expiradas");
  assert.equal(alert.severity, "medium");
  assert.equal(alert.urgency, "today");
  assert.equal(alert.affectedCount, 2);
});

test("sin inscripciones expiradas no hay alerta", async () => {
  const collector = createClickatonCollector(stubPort(), WINDOW, OPTIONS);
  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "clickaton:expired-registrations"),
    undefined,
  );
});

test("avisa cuando se rechazaron fotos en la admisión técnica", async () => {
  const collector = createClickatonCollector(
    stubPort({
      async activity(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return emptyActivity();
        return {
          photoSubmissions: 50,
          photoSubmissionsByStatus: { APPROVED: 30, REJECTED: 20 },
          checkIns: 0,
        };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "clickaton:rejected-submissions");

  assert.ok(alert);
  assert.equal(alert.affectedCount, 20);
});

test("compara los accesos contra el día anterior", async () => {
  const collector = createClickatonCollector(
    stubPort({
      async registrations(range) {
        if (range.start.getTime() === WINDOW.current.start.getTime()) {
          return [registration({ registrationId: "a" }), registration({ registrationId: "b" })];
        }
        if (range.start.getTime() === WINDOW.previous.start.getTime()) {
          return [registration({ registrationId: "c" })];
        }
        return [];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const metric = result.section.groups
    .flatMap((group) => group.metrics)
    .find((item) => item.key === "confirmedRegistrations");

  assert.equal(metric?.previousValue, 1);
  assert.equal(metric?.changeRatio, 1);
});
