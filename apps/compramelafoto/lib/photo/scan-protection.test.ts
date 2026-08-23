import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SCAN_MAX_DURATION_MS,
  SCAN_MIN_DURATION_MS,
  computeContainedRect,
  computeScanDurationMs,
  shouldApplyScanProtection,
} from "./scan-protection";

describe("shouldApplyScanProtection", () => {
  it("protege una foto no comprada en una vista que activa la protección", () => {
    assert.equal(shouldApplyScanProtection({ enabled: true, purchased: false }), true);
  });

  it("no protege una foto ya comprada", () => {
    assert.equal(shouldApplyScanProtection({ enabled: true, purchased: true }), false);
  });

  it("no protege en vistas que no la activan (paneles internos)", () => {
    assert.equal(shouldApplyScanProtection({ enabled: false, purchased: false }), false);
    assert.equal(shouldApplyScanProtection({ enabled: false, purchased: true }), false);
  });

  it("por defecto no protege: la protección es opt-in", () => {
    assert.equal(shouldApplyScanProtection(), false);
    assert.equal(shouldApplyScanProtection({}), false);
  });
});

describe("computeScanDurationMs", () => {
  it("mantiene velocidad constante: una foto más alta tarda más", () => {
    const corta = computeScanDurationMs({ frameHeightPx: 500, bandHeightPx: 44 });
    const larga = computeScanDurationMs({ frameHeightPx: 900, bandHeightPx: 44 });
    assert.ok(larga > corta, `esperaba ${larga} > ${corta}`);
  });

  it("respeta los límites mínimo y máximo", () => {
    assert.equal(computeScanDurationMs({ frameHeightPx: 10, bandHeightPx: 4 }), SCAN_MIN_DURATION_MS);
    assert.equal(
      computeScanDurationMs({ frameHeightPx: 100000, bandHeightPx: 44 }),
      SCAN_MAX_DURATION_MS,
    );
  });

  it("con prefers-reduced-motion el recorrido es mucho más lento, pero sigue", () => {
    const normal = computeScanDurationMs({ frameHeightPx: 600, bandHeightPx: 44 });
    const reducido = computeScanDurationMs({
      frameHeightPx: 600,
      bandHeightPx: 44,
      reducedMotion: true,
    });
    assert.ok(reducido > normal * 2, `esperaba ${reducido} mucho mayor que ${normal}`);
    assert.ok(Number.isFinite(reducido) && reducido > 0, "la animación no debe quedar detenida");
  });

  it("devuelve una duración usable si todavía no se midió la imagen", () => {
    const d = computeScanDurationMs({ frameHeightPx: 0, bandHeightPx: 0 });
    assert.ok(d >= SCAN_MIN_DURATION_MS && d <= SCAN_MAX_DURATION_MS);
    const invalida = computeScanDurationMs({ frameHeightPx: Number.NaN, bandHeightPx: 44 });
    assert.ok(invalida > 0);
  });
});

describe("computeContainedRect", () => {
  it("foto horizontal: deja bandas arriba y abajo, nunca a los costados", () => {
    const r = computeContainedRect(4000, 2000, 800, 800);
    assert.equal(Math.round(r.width), 800);
    assert.equal(Math.round(r.height), 400);
    assert.equal(Math.round(r.offsetX), 0);
    assert.equal(Math.round(r.offsetY), 200);
  });

  it("foto vertical: deja bandas a los costados", () => {
    const r = computeContainedRect(2000, 4000, 800, 800);
    assert.equal(Math.round(r.width), 400);
    assert.equal(Math.round(r.height), 800);
    assert.equal(Math.round(r.offsetX), 200);
    assert.equal(Math.round(r.offsetY), 0);
  });

  it("foto cuadrada: ocupa toda la caja", () => {
    const r = computeContainedRect(1000, 1000, 600, 600);
    assert.deepEqual(
      { w: Math.round(r.width), h: Math.round(r.height), x: r.offsetX, y: r.offsetY },
      { w: 600, h: 600, x: 0, y: 0 },
    );
  });

  it("el área calculada nunca excede la caja: la franja no sale de la foto", () => {
    for (const [nw, nh] of [[3000, 1200], [1200, 3000], [1000, 1000], [5000, 4999]]) {
      const r = computeContainedRect(nw, nh, 900, 700);
      assert.ok(r.width <= 900 + 0.001, "ancho fuera de la caja");
      assert.ok(r.height <= 700 + 0.001, "alto fuera de la caja");
      assert.ok(r.offsetX >= 0 && r.offsetY >= 0, "offset negativo");
    }
  });

  it("no rompe con medidas inválidas", () => {
    const r = computeContainedRect(0, 0, 800, 600);
    assert.equal(r.width, 800);
    assert.equal(r.height, 600);
    const r2 = computeContainedRect(100, 100, 0, 0);
    assert.equal(r2.width, 0);
    assert.equal(r2.height, 0);
  });
});
