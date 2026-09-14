import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PREVIEW_MAX_RATIO,
  PREVIEW_MAX_SECONDS,
  buildFragmentPlan,
} from "./ffmpeg.js";

/** Cuánto dura el adelanto completo según el plan. */
function totalAdelanto(duration: number): number {
  const p = buildFragmentPlan(duration);
  return p.count * p.fragSeconds;
}

describe("cuánto del video muestra el adelanto", () => {
  it("un video largo muestra 15 segundos: una porción mínima", () => {
    // Una ceremonia de 15 minutos: 15s es el 1,7%. Robarlo no sirve de nada.
    assert.equal(totalAdelanto(900), PREVIEW_MAX_SECONDS);
    assert.ok(totalAdelanto(900) / 900 < 0.05);
  });

  it("NUNCA muestra más de un cuarto del video", () => {
    // Antes, un video de 10 segundos mostraba 6: el 60% del producto.
    for (const d of [5, 8, 10, 12, 15, 18, 20, 25, 30, 45, 60, 90, 120, 300]) {
      const ratio = totalAdelanto(d) / d;
      assert.ok(
        ratio <= PREVIEW_MAX_RATIO + 0.02,
        `un video de ${d}s muestra el ${Math.round(ratio * 100)}%`
      );
    }
  });

  it("el video de 18 segundos ya no muestra la mitad", () => {
    const ratio = totalAdelanto(18) / 18;
    assert.ok(ratio <= 0.3, `muestra el ${Math.round(ratio * 100)}%`);
  });

  it("aun así el adelanto se entiende: nunca queda en nada", () => {
    // Un adelanto de dos décimas no le sirve a nadie para decidir la compra.
    for (const d of [5, 10, 18, 30, 60]) {
      assert.ok(totalAdelanto(d) >= 1, `un video de ${d}s da un adelanto inservible`);
    }
  });

  it("los fragmentos siempre entran dentro del video", () => {
    for (const d of [3, 5, 10, 18, 30, 60, 300]) {
      const p = buildFragmentPlan(d);
      for (const s of p.starts) {
        assert.ok(s >= 0, `arranque negativo en ${d}s`);
        assert.ok(
          s + p.fragSeconds <= d + 0.01,
          `un fragmento de ${d}s se pasa del final`
        );
      }
    }
  });

  it("reparte los fragmentos a lo largo del video, no todos al principio", () => {
    const p = buildFragmentPlan(60);
    assert.ok(p.count >= 2);
    assert.ok(
      p.starts[p.starts.length - 1]! > 30,
      "el último fragmento sale de la primera mitad"
    );
  });

  it("un video muy corto sigue dando algo mostrable", () => {
    const p = buildFragmentPlan(2);
    assert.ok(p.count >= 1);
    assert.ok(p.fragSeconds > 0);
  });
});
