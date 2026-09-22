import assert from "node:assert/strict";
import test from "node:test";

import { evaluateReadiness } from "./readiness";

const AHORA = Date.parse("2026-10-05T15:00:00.000Z");
const LIMITES = { toleranceMinutes: 5, minWidth: 800, minHeight: 600 };

const OK = {
  hasGps: true,
  captureAtMs: AHORA - 60_000,
  width: 4032,
  height: 3024,
};

test("una foto recién sacada, con GPS y tamaño suficiente, está lista", () => {
  const v = evaluateReadiness({
    measurements: OK,
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "READY");
  assert.deepEqual(v.problems, []);
  assert.equal(
    v.clockDeltaMinutes,
    -1,
    "la foto se sacó un minuto ANTES que el reloj del servidor: negativo",
  );
});

test("sin coordenadas el veredicto es NO_GPS", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, hasGps: false },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "NO_GPS");
});

test("el reloj adelantado más que la tolerancia da CLOCK_OFF", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, captureAtMs: AHORA + 40 * 60_000 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "CLOCK_OFF");
  assert.equal(v.clockDeltaMinutes, 40);
});

test("el reloj atrasado más que la tolerancia también da CLOCK_OFF", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, captureAtMs: AHORA - 40 * 60_000 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "CLOCK_OFF");
  assert.equal(v.clockDeltaMinutes, -40);
});

test("justo en el borde de la tolerancia todavía está listo", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, captureAtMs: AHORA - 5 * 60_000 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "READY");
});

test("una foto vertical válida con lado corto entre los mínimos está lista", () => {
  // El lado corto (700) queda entre los dos mínimos (600 y 800).
  // Acá se ve si los lados se ordenan (correcto) o se comparan eje por eje (ingenuo).
  // Implementación correcta: ordena [2000, 700] y [800, 600], compara 2000>800 y 700>600 → READY
  // Implementación ingenua: compara 700<800 → TOO_SMALL (equivocado)
  const v = evaluateReadiness({
    measurements: { ...OK, width: 700, height: 2000 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "READY");
});

test("una foto vertical demasiado chica por el lado corto falla", () => {
  // El lado corto (500) está por debajo del mínimo menor (600).
  // Ambas implementaciones rechazan esto, pero el caso anterior sólo uno lo rechaza.
  const v = evaluateReadiness({
    measurements: { ...OK, width: 500, height: 2000 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "TOO_SMALL");
});

test("una foto chica de verdad da TOO_SMALL", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, width: 640, height: 480 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "TOO_SMALL");
});

test("sin fecha de captura el veredicto es NO_CAPTURE_DATE", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, captureAtMs: null },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "NO_CAPTURE_DATE");
  assert.equal(v.clockDeltaMinutes, null);
});

test("cuando hay varios problemas, el resultado nombra el más importante y problems los lista todos", () => {
  const v = evaluateReadiness({
    measurements: { hasGps: false, captureAtMs: AHORA - 40 * 60_000, width: 640, height: 480 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "NO_GPS", "sin GPS no sirve para el mapa: manda ese");
  assert.deepEqual(
    [...v.problems].sort(),
    ["CLOCK_OFF", "NO_GPS", "TOO_SMALL"],
    "pero se informan los tres para que arregle todo de una",
  );
});

test("dimensiones imposibles dan FAILED", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, width: 0, height: 0 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "FAILED");
});
