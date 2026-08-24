import assert from "node:assert/strict";
import { test } from "node:test";

import type { FaceRecognitionPort, FaceRecognitionStats } from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createFaceRecognitionCollector } from "./face-recognition";

const WINDOW = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));
const OPTIONS = { adminBaseUrl: "https://compramelafoto.com" };

function stats(overrides: Partial<FaceRecognitionStats> = {}): FaceRecognitionStats {
  return {
    photosAnalyzedDone: 0,
    photosAnalyzedPending: 0,
    photosAnalyzedError: 0,
    facesDetected: 0,
    matchEvents: 0,
    interestsWithSearch: 0,
    interestsWithAnyMatch: 0,
    oldestPendingAt: null,
    ...overrides,
  };
}

function stubPort(byRange: (isCurrent: boolean) => FaceRecognitionStats): FaceRecognitionPort {
  return {
    async stats(range) {
      return byRange(range.start.getTime() === WINDOW.current.start.getTime());
    },
  };
}

test("calcula la tasa de coincidencia", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort(() => stats({ interestsWithSearch: 40, interestsWithAnyMatch: 30 })),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const metric = result.section.groups
    .flatMap((group) => group.metrics)
    .find((item) => item.key === "matchRate");

  assert.equal(metric?.value, 75);
  assert.equal(metric?.format, "percent");
});

test("cero búsquedas no produce una división por cero", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort(() => stats()),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const metric = result.section.groups
    .flatMap((group) => group.metrics)
    .find((item) => item.key === "matchRate");

  assert.equal(metric?.value, 0);
});

test("hubo búsquedas y ninguna coincidencia: alerta alta e inmediata", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort((isCurrent) =>
      isCurrent
        ? stats({ interestsWithSearch: 25, interestsWithAnyMatch: 0, facesDetected: 500 })
        : stats({ interestsWithSearch: 20, interestsWithAnyMatch: 15 }),
    ),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "face-recognition:no-matches");

  assert.ok(alert);
  assert.equal(alert.severity, "high");
  assert.equal(alert.urgency, "immediate");
});

test("sin búsquedas en el día no se alerta por falta de coincidencias", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort(() => stats()),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "face-recognition:no-matches"),
    undefined,
  );
});

test("los análisis con error generan alerta media para hoy", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort((isCurrent) => (isCurrent ? stats({ photosAnalyzedError: 12 }) : stats())),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "face-recognition:analysis-errors");

  assert.ok(alert);
  assert.equal(alert.severity, "medium");
  assert.equal(alert.urgency, "today");
  assert.equal(alert.affectedCount, 12);
});

test("una caída de la tasa de coincidencia contra la semana previa se avisa", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort((isCurrent) =>
      isCurrent
        ? stats({ interestsWithSearch: 40, interestsWithAnyMatch: 8 })
        : stats({ interestsWithSearch: 100, interestsWithAnyMatch: 80 }),
    ),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "face-recognition:match-rate-drop");

  assert.ok(alert, "esperaba alerta por degradación de la tasa de coincidencia");
  assert.equal(alert.severity, "high");
});
