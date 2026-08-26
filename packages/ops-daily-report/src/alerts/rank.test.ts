import assert from "node:assert/strict";
import { test } from "node:test";

import type { ReportAlert } from "../contracts/alert";
import { rankAlerts } from "./rank";

function alert(overrides: Partial<ReportAlert> & { id: string }): ReportAlert {
  return {
    platform: "platform",
    title: "Título",
    detail: "Detalle",
    severity: "medium",
    urgency: "today",
    affectedCount: null,
    since: null,
    ...overrides,
  };
}

test("la urgencia pesa más que la gravedad", () => {
  const ranked = rankAlerts([
    alert({ id: "critica-lenta", severity: "critical", urgency: "thisWeek" }),
    alert({ id: "alta-ya", severity: "high", urgency: "immediate" }),
  ]);

  assert.deepEqual(
    ranked.map((item) => item.id),
    ["alta-ya", "critica-lenta"],
  );
});

test("con la misma urgencia manda la gravedad", () => {
  const ranked = rankAlerts([
    alert({ id: "media", severity: "medium", urgency: "immediate" }),
    alert({ id: "critica", severity: "critical", urgency: "immediate" }),
  ]);

  assert.deepEqual(
    ranked.map((item) => item.id),
    ["critica", "media"],
  );
});

test("a igual urgencia y gravedad, primero la que afecta a más casos", () => {
  const ranked = rankAlerts([
    alert({ id: "pocos", severity: "high", urgency: "today", affectedCount: 3 }),
    alert({ id: "muchos", severity: "high", urgency: "today", affectedCount: 120 }),
  ]);

  assert.deepEqual(
    ranked.map((item) => item.id),
    ["muchos", "pocos"],
  );
});

test("el desempate final es estable por identificador", () => {
  const ranked = rankAlerts([
    alert({ id: "b", severity: "low", urgency: "informational" }),
    alert({ id: "a", severity: "low", urgency: "informational" }),
  ]);

  assert.deepEqual(
    ranked.map((item) => item.id),
    ["a", "b"],
  );
});

test("no modifica el arreglo recibido", () => {
  const original = [
    alert({ id: "z", severity: "low", urgency: "informational" }),
    alert({ id: "a", severity: "critical", urgency: "immediate" }),
  ];
  rankAlerts(original);

  assert.equal(original[0]!.id, "z");
});

test("una lista vacía devuelve una lista vacía", () => {
  assert.deepEqual(rankAlerts([]), []);
});
