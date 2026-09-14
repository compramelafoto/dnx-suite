import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureCanvasGlobals } from "./canvas-globals";

/**
 * `pdfjs` da por sentado que corre en un navegador y usa `DOMMatrix` para dibujar ciertas
 * transformaciones. Node no la trae. Cuando falta, la conversión a PNG muere con
 * "DOMMatrix is not defined" — y sólo en las piezas que pasan por ese camino, así que el fallo
 * aparece en producción y no en la máquina de quien lo escribió.
 */
test("deja disponible DOMMatrix, que pdfjs da por sentada", async () => {
  await ensureCanvasGlobals();

  assert.equal(typeof (globalThis as Record<string, unknown>).DOMMatrix, "function");
});

/**
 * Publicar además `Path2D` o `ImageData` hace que `pdfjs` tome caminos de dibujo que le pasan
 * esos objetos al módulo nativo, que espera los suyos y falla con "Value is non of these
 * types". Rompió tres pruebas de emisión antes de que quedara acotado a `DOMMatrix`.
 */
test("no publica las demás, que rompen la rasterización", async () => {
  await ensureCanvasGlobals();

  for (const nombre of ["Path2D", "ImageData"] as const) {
    assert.equal(
      (globalThis as Record<string, unknown>)[nombre],
      undefined,
      `${nombre} no tiene que definirse`,
    );
  }
});

test("no pisa una implementación que el entorno ya provea", async () => {
  const propia = function DOMMatrixPropia() {};
  const previo = (globalThis as Record<string, unknown>).DOMMatrix;
  (globalThis as Record<string, unknown>).DOMMatrix = propia;

  await ensureCanvasGlobals();

  assert.equal((globalThis as Record<string, unknown>).DOMMatrix, propia);
  (globalThis as Record<string, unknown>).DOMMatrix = previo;
});
