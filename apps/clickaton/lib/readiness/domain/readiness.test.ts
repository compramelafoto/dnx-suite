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

// Los dos casos que siguen son el par que discrimina la regla. La cañería
// real del concurso (`lib/photo-upload/service.ts`) compara EJE POR EJE:
// `width < minWidth || height < minHeight`. Con mínimos de 800×600, la misma
// cantidad de píxeles da distinto según cómo esté parada la foto, y eso es a
// propósito: esta pantalla sirve para predecir el veredicto del 12/12.
//
// Si alguien "arregla" el dominio ordenando los lados (comparar el lado largo
// contra 800 y el corto contra 600), el primero de los dos empieza a dar
// READY y falla. El segundo lo acompaña: descarta que 700×2000 falle por una
// razón genérica — por ejemplo, que cualquier lado de 700 esté prohibido.
test("700×2000 es demasiado angosta: el ancho no llega al mínimo de ancho", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, width: 700, height: 2000 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(
    v.result,
    "TOO_SMALL",
    "700 < minWidth 800: el día del evento esta foto se rechaza, así que acá no puede decir READY. Una regla que ordene los lados diría READY y mentiría.",
  );
});

test("la misma foto acostada, 2000×700, sí está lista", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, width: 2000, height: 700 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(
    v.result,
    "READY",
    "2000 ≥ 800 y 700 ≥ 600: con los mismos píxeles que el caso anterior el veredicto cambia, porque la regla mira cada eje contra SU mínimo",
  );
});

test("justo en el mínimo de cada eje todavía está lista", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, width: 800, height: 600 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(
    v.result,
    "READY",
    "la cañería rechaza con `<`, no con `<=`: el mínimo exacto entra. Si alguien cambia el operador, este caso falla.",
  );
});

test("un píxel menos de ancho que el mínimo ya no entra", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, width: 799, height: 600 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(v.result, "TOO_SMALL", "799 < 800: el borde de abajo del ancho");
});

test("un píxel menos de alto que el mínimo tampoco", () => {
  const v = evaluateReadiness({
    measurements: { ...OK, width: 800, height: 599 },
    limits: LIMITES,
    serverNowMs: AHORA,
  });
  assert.equal(
    v.result,
    "TOO_SMALL",
    "599 < 600: el alto se compara contra minHeight, no contra el mínimo menor de los dos",
  );
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
