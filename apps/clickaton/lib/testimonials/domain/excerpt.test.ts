import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExcerpt } from "./excerpt.ts";

test("una cita corta se usa entera", () => {
  assert.equal(
    buildExcerpt("Fue una experiencia enorme."),
    "Fue una experiencia enorme.",
  );
});

test("los espacios y saltos de línea repetidos se normalizan", () => {
  assert.equal(buildExcerpt("Hola   \n\n  mundo"), "Hola mundo");
});

test("una cita larga se corta y termina en elipsis", () => {
  const larga = "palabra ".repeat(60).trim();
  const out = buildExcerpt(larga, 40);
  assert.ok(out.length <= 41, `midió ${out.length}`);
  assert.ok(out.endsWith("…"));
});

test("el corte cae en un límite de palabra, no a la mitad", () => {
  const out = buildExcerpt("Corrimos toda la madrugada juntos", 20);
  assert.equal(out, "Corrimos toda la…");
});

test("una palabra sola más larga que el límite se corta igual", () => {
  const out = buildExcerpt("supercalifragilisticoespialidoso", 10);
  assert.equal(out, "supercalif…");
});

test("una cita vacía devuelve vacío", () => {
  assert.equal(buildExcerpt("   "), "");
  assert.equal(buildExcerpt(""), "");
});
