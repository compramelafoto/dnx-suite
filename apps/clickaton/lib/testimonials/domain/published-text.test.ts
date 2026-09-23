import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedText } from "./published-text";
import { QUOTE_MAX_LENGTH, EXCERPT_MAX_LENGTH } from "./survey-definition";

test("sin recorte elegido, se publica el testimonio COMPLETO", () => {
  const largo = "Fue una experiencia enorme. ".repeat(12).trim();
  assert.ok(largo.length > 300, "el caso de prueba tiene que ser largo");

  const salida = publishedText({ quote: largo, highlightedExcerpt: null });
  assert.equal(salida, largo, "no se puede recortar lo que el autor escribió");
  assert.ok(!salida.endsWith("…"));
});

test("si el admin eligió un recorte, se publica ese", () => {
  const salida = publishedText({
    quote: "Texto largo original que el autor escribió entero.",
    highlightedExcerpt: "Texto largo original",
  });
  assert.equal(salida, "Texto largo original");
});

test("un recorte vacío o en blanco no tapa el texto completo", () => {
  const quote = "Lo que el autor escribió.";
  assert.equal(publishedText({ quote, highlightedExcerpt: "" }), quote);
  assert.equal(publishedText({ quote, highlightedExcerpt: "   " }), quote);
});

test("los espacios y saltos repetidos se normalizan, pero nada se pierde", () => {
  const salida = publishedText({
    quote: "Dos    espacios\n\ny un salto",
    highlightedExcerpt: null,
  });
  assert.equal(salida, "Dos espacios y un salto");
});

test("el recorte admite el testimonio entero: los topes coinciden", () => {
  assert.equal(EXCERPT_MAX_LENGTH, QUOTE_MAX_LENGTH);
});
