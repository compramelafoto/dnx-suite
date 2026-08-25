import assert from "node:assert/strict";
import { test } from "node:test";

import type { FotorankActivity, FotorankPort, FotorankRegistrationRow } from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createFotorankCollector } from "./fotorank";

const WINDOW = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));
const OPTIONS = { adminBaseUrl: "https://fotorank.dnxsuite.com" };

function registration(
  overrides: Partial<FotorankRegistrationRow> & { registrationId: string },
): FotorankRegistrationRow {
  return {
    contestId: "c-1",
    contestTitle: "Santa Fe en Foco",
    status: "CONFIRMED",
    priceArs: 3_000,
    ...overrides,
  };
}

function emptyActivity(): FotorankActivity {
  return {
    activeContests: 0,
    entriesSubmitted: 0,
    entriesByStatus: {},
    entriesAwaitingReview: 0,
    juryVotes: 0,
    activeJudges: 0,
    diplomasIssued: 0,
  };
}

function stubPort(overrides: Partial<FotorankPort> = {}): FotorankPort {
  return {
    async registrations() {
      return [];
    },
    async activity() {
      return emptyActivity();
    },
    ...overrides,
  };
}

type RunResult = Awaited<ReturnType<ReturnType<typeof createFotorankCollector>["run"]>>;

function metricValue(result: RunResult, key: string): number {
  for (const group of result.section.groups) {
    for (const metric of group.metrics) {
      if (metric.key === key) return metric.value;
    }
  }
  throw new Error(`No se encontró la métrica ${key}`);
}

test("cuenta inscripciones confirmadas y su facturación", async () => {
  const collector = createFotorankCollector(
    stubPort({
      async registrations(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [
          registration({ registrationId: "a", priceArs: 3_000 }),
          registration({ registrationId: "b", priceArs: 3_000 }),
          registration({ registrationId: "c", status: "PENDING_PAYMENT", priceArs: 3_000 }),
        ];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "confirmedRegistrations"), 2);
  assert.equal(metricValue(result, "registrationRevenueArs"), 6_000);
  assert.equal(metricValue(result, "pendingRegistrations"), 1);
});

test("las inscripciones gratuitas no rompen la facturación", async () => {
  const collector = createFotorankCollector(
    stubPort({
      async registrations(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [registration({ registrationId: "a", priceArs: 0 })];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "confirmedRegistrations"), 1);
  assert.equal(metricValue(result, "registrationRevenueArs"), 0);
});

test("arma el ranking de concursos por inscripciones", async () => {
  const collector = createFotorankCollector(
    stubPort({
      async registrations(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [
          registration({ registrationId: "a", contestId: "x", contestTitle: "Concurso X" }),
          registration({ registrationId: "b", contestId: "y", contestTitle: "Concurso Y" }),
          registration({ registrationId: "c", contestId: "y", contestTitle: "Concurso Y" }),
        ];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const ranking = result.section.tables.find((table) => table.title.includes("concursos"));

  assert.ok(ranking);
  assert.equal(ranking.rows[0]![0], "Concurso Y");
  assert.equal(ranking.rows[0]![1], 2);
});

test("informa el avance del jurado", async () => {
  const collector = createFotorankCollector(
    stubPort({
      async activity(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return emptyActivity();
        return {
          ...emptyActivity(),
          juryVotes: 240,
          activeJudges: 6,
          entriesSubmitted: 55,
          diplomasIssued: 12,
        };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "juryVotes"), 240);
  assert.equal(metricValue(result, "activeJudges"), 6);
  assert.equal(metricValue(result, "entriesSubmitted"), 55);
  assert.equal(metricValue(result, "diplomasIssued"), 12);
});

test("avisa cuando hay obras esperando revisión manual", async () => {
  const collector = createFotorankCollector(
    stubPort({
      async activity() {
        return { ...emptyActivity(), entriesAwaitingReview: 14 };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "fotorank:entries-awaiting-review");

  assert.ok(alert, "esperaba alerta por obras sin revisar");
  assert.equal(alert.severity, "medium");
  assert.equal(alert.urgency, "today");
  assert.equal(alert.affectedCount, 14);
});

test("sin obras pendientes de revisión no hay alerta", async () => {
  const collector = createFotorankCollector(stubPort(), WINDOW, OPTIONS);
  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "fotorank:entries-awaiting-review"),
    undefined,
  );
});

test("un día sin actividad deja la tabla vacía con su mensaje", async () => {
  const collector = createFotorankCollector(stubPort(), WINDOW, OPTIONS);
  const result = await collector.run();
  const ranking = result.section.tables.find((table) => table.title.includes("concursos"));

  assert.equal(ranking?.rows.length, 0);
  assert.match(ranking?.emptyMessage ?? "", /sin inscripciones/i);
});
