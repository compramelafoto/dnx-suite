import assert from "node:assert/strict";
import { test } from "node:test";

import type { InfoSpotPort, InfoSpotStats } from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createInfoSpotCollector } from "./infospot";

const WINDOW = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));
const OPTIONS = { adminBaseUrl: "https://infospot.dnxsuite.com" };

function stats(overrides: Partial<InfoSpotStats> = {}): InfoSpotStats {
  return {
    articlesPublished: 0,
    articlesInReview: 0,
    articleViews: 0,
    topArticles: [],
    newCoverages: 0,
    clicksToClf: 0,
    ...overrides,
  };
}

function stubPort(byRange: (isCurrent: boolean) => InfoSpotStats): InfoSpotPort {
  return {
    async stats(range) {
      return byRange(range.start.getTime() === WINDOW.current.start.getTime());
    },
  };
}

type RunResult = Awaited<ReturnType<ReturnType<typeof createInfoSpotCollector>["run"]>>;

function metricValue(result: RunResult, key: string): number {
  for (const group of result.section.groups) {
    for (const metric of group.metrics) {
      if (metric.key === key) return metric.value;
    }
  }
  throw new Error(`No se encontró la métrica ${key}`);
}

test("informa artículos publicados y vistas", async () => {
  const collector = createInfoSpotCollector(
    stubPort((isCurrent) =>
      isCurrent ? stats({ articlesPublished: 4, articleViews: 1_250 }) : stats(),
    ),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "articlesPublished"), 4);
  assert.equal(metricValue(result, "articleViews"), 1_250);
});

test("arma la tabla de notas más leídas", async () => {
  const collector = createInfoSpotCollector(
    stubPort((isCurrent) =>
      isCurrent
        ? stats({
            articleViews: 300,
            topArticles: [
              { title: "Nota A", views: 200 },
              { title: "Nota B", views: 100 },
            ],
          })
        : stats(),
    ),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const tabla = result.section.tables.find((table) => table.title.includes("leídas"));

  assert.ok(tabla);
  assert.equal(tabla.rows[0]![0], "Nota A");
  assert.equal(tabla.rows[0]![1], 200);
});

test("informa el tráfico derivado a ComprameLaFoto", async () => {
  const collector = createInfoSpotCollector(
    stubPort((isCurrent) => (isCurrent ? stats({ clicksToClf: 87 }) : stats())),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "clicksToClf"), 87);
});

test("cero vistas habiendo notas publicadas dispara alerta", async () => {
  const collector = createInfoSpotCollector(
    stubPort((isCurrent) =>
      isCurrent
        ? stats({ articlesPublished: 3, articleViews: 0 })
        : stats({ articlesPublished: 2, articleViews: 900 }),
    ),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "infospot:no-views");

  assert.ok(alert, "esperaba alerta por ausencia total de vistas");
  assert.equal(alert.severity, "high");
});

test("cero vistas sin notas publicadas ni historial no alerta", async () => {
  const collector = createInfoSpotCollector(
    stubPort(() => stats()),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "infospot:no-views"),
    undefined,
  );
});

test("un día sin notas leídas muestra el mensaje de tabla vacía", async () => {
  const collector = createInfoSpotCollector(
    stubPort(() => stats()),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const tabla = result.section.tables.find((table) => table.title.includes("leídas"));

  assert.equal(tabla?.rows.length, 0);
  assert.match(tabla?.emptyMessage ?? "", /sin lecturas/i);
});
