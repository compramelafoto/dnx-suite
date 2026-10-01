import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { FRAME_EDGE_MARGIN_RATIO, frameKey, planFrameTimes } from "./frames.js";

describe("planFrameTimes", () => {
  it("reparte los fotogramas a lo largo del video", () => {
    const times = planFrameTimes({ durationSeconds: 100, count: 5 });
    assert.equal(times.length, 5);
    // Ordenados y todos distintos.
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
    assert.equal(new Set(times).size, 5);
  });

  it("evita el arranque y el final, donde suele haber títulos o negro", () => {
    const duration = 100;
    const times = planFrameTimes({ durationSeconds: duration, count: 10 });
    const margen = duration * FRAME_EDGE_MARGIN_RATIO;
    assert.ok(times[0]! >= margen, `el primero (${times[0]}) cae antes del margen`);
    assert.ok(
      times.at(-1)! <= duration - margen,
      `el último (${times.at(-1)}) cae después del margen`
    );
  });

  it("en un video muy corto devuelve al menos un fotograma válido", () => {
    const times = planFrameTimes({ durationSeconds: 2, count: 20 });
    assert.ok(times.length >= 1);
    for (const t of times) {
      assert.ok(t > 0 && t < 2, `el segundo ${t} cae fuera del video`);
    }
  });

  it("nunca pide más fotogramas que segundos útiles: no repite el mismo instante", () => {
    const times = planFrameTimes({ durationSeconds: 5, count: 20 });
    assert.equal(new Set(times).size, times.length);
  });

  it("no devuelve nada si la duración es inválida", () => {
    assert.deepEqual(planFrameTimes({ durationSeconds: 0, count: 20 }), []);
    assert.deepEqual(planFrameTimes({ durationSeconds: -3, count: 20 }), []);
  });

  it("no devuelve nada si se piden cero fotogramas (función apagada)", () => {
    assert.deepEqual(planFrameTimes({ durationSeconds: 120, count: 0 }), []);
  });

  it("redondea a centésimas para que la clave y la base coincidan", () => {
    const times = planFrameTimes({ durationSeconds: 7, count: 3 });
    for (const t of times) {
      assert.equal(t, Math.round(t * 100) / 100);
    }
  });
});

describe("frameKey", () => {
  it("arma la ruta con el milisegundo, así dos fotogramas nunca chocan", () => {
    assert.equal(
      frameKey(12, 345, 6.78),
      "albums/12/videos/frames/345/6780.jpg"
    );
  });

  it("usa enteros de milisegundos, sin decimales en la ruta", () => {
    assert.equal(frameKey(1, 2, 0.5), "albums/1/videos/frames/2/500.jpg");
    assert.equal(frameKey(1, 2, 10), "albums/1/videos/frames/2/10000.jpg");
  });
});
