/**
 * Una foto de cámara profesional pesa 8, 15 o 40 MB, y el tope de una acción
 * de servidor en Vercel es 4,5 MB. Achicarla en el navegador evita depender de
 * la subida directa al bucket, que necesita un CORS que sigue pendiente.
 *
 * Acá se prueba el cálculo de medidas, que es lo que se puede probar sin
 * navegador y es donde están los errores que importan.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { medidasDeDestino, LADO_LARGO_MAXIMO } from "./achicarImagen";

test("una foto chica no se agranda", () => {
  assert.deepEqual(medidasDeDestino(800, 600), { ancho: 800, alto: 600 });
});

test("una apaisada se achica por el ancho", () => {
  assert.deepEqual(medidasDeDestino(6000, 4000), { ancho: 2000, alto: 1333 });
});

test("una vertical se achica por el alto", () => {
  assert.deepEqual(medidasDeDestino(4000, 6000), { ancho: 1333, alto: 2000 });
});

test("una cuadrada queda cuadrada", () => {
  assert.deepEqual(medidasDeDestino(5000, 5000), {
    ancho: LADO_LARGO_MAXIMO,
    alto: LADO_LARGO_MAXIMO,
  });
});

test("una panorámica extrema no queda con altura cero", () => {
  const m = medidasDeDestino(12000, 300);
  assert.equal(m.ancho, LADO_LARGO_MAXIMO);
  assert.ok(m.alto >= 1, `el alto mínimo es 1 píxel, dio ${m.alto}`);
});

test("justo en el límite no se toca", () => {
  assert.deepEqual(medidasDeDestino(LADO_LARGO_MAXIMO, 1000), {
    ancho: LADO_LARGO_MAXIMO,
    alto: 1000,
  });
});

test("medidas inválidas no rompen", () => {
  assert.deepEqual(medidasDeDestino(0, 0), { ancho: 0, alto: 0 });
  assert.deepEqual(medidasDeDestino(-5, 100), { ancho: 0, alto: 0 });
});

test("la proporción se mantiene", () => {
  const original = 6000 / 4000;
  const m = medidasDeDestino(6000, 4000);
  assert.ok(Math.abs(m.ancho / m.alto - original) < 0.01, "la foto no se deforma");
});
