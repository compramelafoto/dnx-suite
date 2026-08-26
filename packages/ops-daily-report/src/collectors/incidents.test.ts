import assert from "node:assert/strict";
import { test } from "node:test";

import type { IncidentsPort } from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createIncidentsCollector } from "./incidents";

const NOW = new Date("2026-08-24T03:00:00.000Z");
const WINDOW = resolveArgentinaDayWindow(NOW);
const OPTIONS = { adminBaseUrl: "https://compramelafoto.com", now: NOW };

function stubPort(overrides: Partial<IncidentsPort> = {}): IncidentsPort {
  return {
    async emailQueue() {
      return { pending: 0, failed: 0, oldestPendingAt: null };
    },
    async unreconciledPaidOrders() {
      return { count: 0, oldestAt: null };
    },
    async openFraudAlerts() {
      return { count: 0, oldestAt: null };
    },
    async jobHealth() {
      return [];
    },
    ...overrides,
  };
}

test("un día limpio no genera alertas", async () => {
  const collector = createIncidentsCollector(stubPort(), WINDOW, OPTIONS);
  const result = await collector.run();

  assert.equal(result.alerts.length, 0);
  assert.equal(result.section.status, "ok");
});

test("la cola de correos trabada más de dos horas es crítica e inmediata", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async emailQueue() {
        return {
          pending: 40,
          failed: 0,
          // Tres horas antes del corte.
          oldestPendingAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
        };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "incidents:email-queue-stuck");

  assert.ok(alert);
  assert.equal(alert.severity, "critical");
  assert.equal(alert.urgency, "immediate");
  assert.equal(alert.affectedCount, 40);
});

test("una cola con pendientes recientes no dispara alerta", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async emailQueue() {
        return {
          pending: 5,
          failed: 0,
          oldestPendingAt: new Date(NOW.getTime() - 10 * 60 * 1000),
        };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "incidents:email-queue-stuck"),
    undefined,
  );
});

test("los pagos sin conciliar son críticos e inmediatos", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async unreconciledPaidOrders() {
        return { count: 3, oldestAt: new Date("2026-08-22T12:00:00.000Z") };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "incidents:unreconciled-payments");

  assert.ok(alert);
  assert.equal(alert.severity, "critical");
  assert.equal(alert.urgency, "immediate");
  assert.equal(alert.since, "2026-08-22T12:00:00.000Z");
});

test("las alertas de fraude abiertas son de gravedad alta para hoy", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async openFraudAlerts() {
        return { count: 2, oldestAt: null };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "incidents:fraud-open");

  assert.ok(alert);
  assert.equal(alert.severity, "high");
  assert.equal(alert.urgency, "today");
});

test("los trabajos trabados generan una alerta por tipo de trabajo", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async jobHealth() {
        return [
          { label: "Generación de ZIP", pending: 4, failed: 0, stuck: 3, oldestPendingAt: null },
          { label: "Ingesta de cámara", pending: 0, failed: 0, stuck: 0, oldestPendingAt: null },
        ];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alerts = result.alerts.filter((item) => item.id.startsWith("incidents:job-stuck:"));

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.severity, "medium");
  assert.equal(alerts[0]!.affectedCount, 3);
  assert.match(alerts[0]!.title, /ZIP/);
});

test("la sección publica el resumen de la cola aunque no haya alertas", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async emailQueue() {
        return { pending: 2, failed: 1, oldestPendingAt: null };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const metrics = result.section.groups.flatMap((group) => group.metrics);

  assert.equal(metrics.find((item) => item.key === "emailQueuePending")?.value, 2);
  assert.equal(metrics.find((item) => item.key === "emailQueueFailed")?.value, 1);
});
