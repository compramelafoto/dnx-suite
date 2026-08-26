import assert from "node:assert/strict";
import { test } from "node:test";

import { runCollector } from "./run-collector";

test("devuelve la sección cuando el colector funciona", async () => {
  const result = await runCollector({
    key: "ventas",
    title: "Ventas",
    async run() {
      return {
        section: {
          key: "ventas",
          title: "Ventas",
          status: "ok",
          error: null,
          groups: [],
          tables: [],
        },
        alerts: [],
      };
    },
  });

  assert.equal(result.section.status, "ok");
  assert.equal(result.section.error, null);
});

test("un colector que explota no tumba el informe", async () => {
  const result = await runCollector({
    key: "fotoffice",
    title: "FotOffice",
    async run() {
      throw new Error("la consulta se cayó");
    },
  });

  assert.equal(result.section.status, "failed");
  assert.equal(result.section.key, "fotoffice");
  assert.equal(result.section.title, "FotOffice");
  assert.match(result.section.error ?? "", /la consulta se cayó/);
});

test("el fallo genera una alerta técnica de gravedad alta", async () => {
  const result = await runCollector({
    key: "fotoffice",
    title: "FotOffice",
    async run() {
      throw new Error("timeout");
    },
  });

  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0]!.severity, "high");
  assert.equal(result.alerts[0]!.urgency, "today");
  assert.equal(result.alerts[0]!.id, "collector-failed:fotoffice");
});

test("un error que no es Error igual se reporta legible", async () => {
  const result = await runCollector({
    key: "raro",
    title: "Raro",
    async run() {
      throw "algo no serializable";
    },
  });

  assert.equal(result.section.status, "failed");
  assert.match(result.section.error ?? "", /algo no serializable/);
});
