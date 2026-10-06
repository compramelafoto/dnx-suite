import assert from "node:assert/strict";
import { test } from "node:test";
import { medirTexto, textoATrazos } from "./trazos";

test("el texto sale en trazos, sin pedirle ninguna fuente al sistema", async () => {
  const { svg, ancho } = await textoATrazos({
    texto: "Ñandú 7,67",
    fontId: "dmSans",
    slot: "bold",
    tamano: 40,
    x: 10,
    y: 50,
    color: "#ffc400",
  });
  assert.doesNotMatch(svg, /<text|font-family/);
  assert.equal((svg.match(/<path /g) ?? []).length, 9); // el espacio no tiene dibujo
  assert.ok(ancho > 150 && ancho < 300, `ancho inesperado: ${ancho}`);
});

test("medir y dibujar dan el mismo ancho, con espaciado incluido", async () => {
  const base = { texto: "PUESTO", fontId: "dmSans" as const, slot: "bold" as const, tamano: 20, espaciado: 3 };
  const medido = await medirTexto(base);
  const { ancho } = await textoATrazos({ ...base, x: 0, y: 0, color: "#fff" });
  assert.ok(Math.abs(medido - ancho) < 0.01, `${medido} vs ${ancho}`);
});
