import assert from "node:assert/strict";
import { test } from "node:test";

import type { FotofficePort, FotofficeStats } from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createFotofficeCollector } from "./fotoffice";

const WINDOW = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));
const OPTIONS = { adminBaseUrl: "https://fotoffice.dnxsuite.com" };

function stats(overrides: Partial<FotofficeStats> = {}): FotofficeStats {
  return {
    newWorkspaces: 0,
    totalWorkspaces: 0,
    newMembers: 0,
    totalMembers: 0,
    newServiceLeads: 0,
    newCourseLeads: 0,
    pendingLeads: 0,
    publishedWebsites: 0,
    enabledModules: {},
    ...overrides,
  };
}

function stubPort(byRange: (isCurrent: boolean) => FotofficeStats): FotofficePort {
  return {
    async stats(range) {
      return byRange(range.start.getTime() === WINDOW.current.start.getTime());
    },
  };
}

type RunResult = Awaited<ReturnType<ReturnType<typeof createFotofficeCollector>["run"]>>;

function metricValue(result: RunResult, key: string): number {
  for (const group of result.section.groups) {
    for (const metric of group.metrics) {
      if (metric.key === key) return metric.value;
    }
  }
  throw new Error(`No se encontró la métrica ${key}`);
}

test("informa espacios de trabajo y socios", async () => {
  const collector = createFotofficeCollector(
    stubPort((isCurrent) =>
      isCurrent
        ? stats({ newWorkspaces: 2, totalWorkspaces: 18, newMembers: 7, totalMembers: 135 })
        : stats(),
    ),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "newWorkspaces"), 2);
  assert.equal(metricValue(result, "totalWorkspaces"), 18);
  assert.equal(metricValue(result, "newMembers"), 7);
  assert.equal(metricValue(result, "totalMembers"), 135);
});

test("suma las consultas de servicios y de cursos", async () => {
  const collector = createFotofficeCollector(
    stubPort((isCurrent) =>
      isCurrent ? stats({ newServiceLeads: 3, newCourseLeads: 5 }) : stats(),
    ),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "newServiceLeads"), 3);
  assert.equal(metricValue(result, "newCourseLeads"), 5);
  assert.equal(metricValue(result, "totalNewLeads"), 8);
});

test("las consultas sin atender disparan alerta", async () => {
  const collector = createFotofficeCollector(
    stubPort(() => stats({ pendingLeads: 9 })),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "fotoffice:pending-leads");

  assert.ok(alert, "esperaba alerta por consultas sin atender");
  assert.equal(alert.severity, "medium");
  assert.equal(alert.urgency, "today");
  assert.equal(alert.affectedCount, 9);
});

test("sin consultas pendientes no hay alerta", async () => {
  const collector = createFotofficeCollector(
    stubPort(() => stats()),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "fotoffice:pending-leads"),
    undefined,
  );
});

test("lista los módulos habilitados por cantidad de espacios", async () => {
  const collector = createFotofficeCollector(
    stubPort((isCurrent) =>
      isCurrent
        ? stats({ enabledModules: { socios: 12, cursos: 5, website: 9 } })
        : stats(),
    ),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const tabla = result.section.tables.find((table) => table.title.includes("módulos"));

  assert.ok(tabla);
  assert.equal(tabla.rows[0]![0], "socios");
  assert.equal(tabla.rows[0]![1], 12);
  assert.equal(tabla.rows[1]![0], "website");
});

test("sin módulos habilitados la tabla muestra su mensaje", async () => {
  const collector = createFotofficeCollector(
    stubPort(() => stats()),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const tabla = result.section.tables.find((table) => table.title.includes("módulos"));

  assert.equal(tabla?.rows.length, 0);
  assert.match(tabla?.emptyMessage ?? "", /sin m[óo]dulos/i);
});
