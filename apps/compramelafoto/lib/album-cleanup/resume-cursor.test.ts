import { strict as assert } from "node:assert";
import { test } from "node:test";
import { planPhotoBatch, nextProcessedCount } from "./resume-cursor.ts";

/**
 * Implementación vieja (con el bug): usaba el contador acumulado como índice
 * dentro de la lista de fotos ACTIVE restantes. Se conserva acá para demostrar
 * que el test discrimina la regresión.
 */
function buggyStartIndex(processedCount: number): number {
  return processedCount;
}

function simulateRun(startIndex: number, remainingActivePhotos: number): number {
  let purged = 0;
  for (let cursor = startIndex; cursor < remainingActivePhotos; cursor += 1) purged += 1;
  return purged;
}

test("caso real de producción: álbum 33 quedaba trabado con 0 fotos purgadas por corrida", () => {
  // Álbum 33 "Festival Faro 2026": contador en 39, quedaban 28 fotos activas.
  const processedCount = 39;
  const remainingActive = 28;

  // La implementación vieja no purgaba nada: deadlock permanente.
  assert.equal(simulateRun(buggyStartIndex(processedCount), remainingActive), 0);

  // La nueva recorre las 28 que quedan.
  const plan = planPhotoBatch(processedCount, remainingActive);
  assert.equal(simulateRun(plan.startIndex, remainingActive), 28);
});

test("caso real de producción: álbum 40 quedaba trabado con 0 fotos purgadas por corrida", () => {
  // Álbum 40 "PADEL 40-15": contador en 130, quedaban 92 fotos activas.
  assert.equal(simulateRun(buggyStartIndex(130), 92), 0);
  assert.equal(simulateRun(planPhotoBatch(130, 92).startIndex, 92), 92);
});

test("el contador acumulado no pierde el histórico al reanudar", () => {
  const plan = planPhotoBatch(39, 28);
  assert.equal(nextProcessedCount(plan, 0), 40, "la primera foto de la corrida es la 40.ª del álbum");
  assert.equal(nextProcessedCount(plan, 27), 67, "la última cierra en 67 = total real del álbum");
});

test("álbum nuevo arranca en cero", () => {
  const plan = planPhotoBatch(0, 150);
  assert.equal(plan.startIndex, 0);
  assert.equal(nextProcessedCount(plan, 0), 1);
});

test("tolera contador nulo o corrupto sin trabar el álbum", () => {
  for (const raw of [null, undefined, -5, Number.NaN]) {
    const plan = planPhotoBatch(raw as number | null | undefined, 10);
    assert.equal(plan.startIndex, 0, `startIndex debe ser 0 para ${String(raw)}`);
    assert.equal(simulateRun(plan.startIndex, 10), 10);
  }
});
