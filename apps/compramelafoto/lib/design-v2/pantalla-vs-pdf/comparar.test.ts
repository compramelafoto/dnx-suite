import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { compararImagenes } from "./comparar";

/**
 * La comparación tiene que dejar pasar lo que una persona no nota (el suavizado distinto de las
 * letras) y frenar lo que sí: un texto corrido, una palabra que falta, una forma de otro color.
 */
async function pagina(textos: Array<{ x: number; y: number; texto: string; color?: string }>, fondo = "#ffffff") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000">
    <rect width="1500" height="1000" fill="${fondo}"/>
    ${textos
      .map(
        (t) =>
          `<text x="${t.x}" y="${t.y}" font-family="sans-serif" font-size="44" fill="${t.color ?? "#1d3a6b"}">${t.texto}</text>`,
      )
      .join("")}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const BASE = [
  { x: 60, y: 100, texto: "Benjamín Pérez" },
  { x: 60, y: 300, texto: "5º A - Colegio San Patricio" },
  { x: 900, y: 800, texto: "Sala 3A" },
];

test("la misma página es igual", async () => {
  const a = await pagina(BASE);
  const r = await compararImagenes(a, a);
  assert.equal(r.aprobado, true);
  assert.equal(r.distinto, 0);
});

test("un suavizado distinto de las letras no cuenta como diferencia", async () => {
  const a = await pagina(BASE);
  const b = await sharp(a).blur(0.6).png().toBuffer();
  assert.equal((await compararImagenes(a, b)).aprobado, true);
});

test("un texto corrido ocho píxeles se detecta", async () => {
  const a = await pagina(BASE);
  const b = await pagina(BASE.map((t, i) => (i === 1 ? { ...t, y: t.y - 8 } : t)));
  assert.equal((await compararImagenes(a, b)).aprobado, false);
});

test("una palabra chica que falta se detecta aunque casi no pese en el total", async () => {
  const a = await pagina(BASE);
  const b = await pagina(BASE.slice(0, 2));
  const r = await compararImagenes(a, b);
  assert.ok(r.distinto < 0.015, "el total solo no alcanzaría para verlo");
  assert.equal(r.aprobado, false);
  assert.ok(r.peorZonaEn.x > 0.5 && r.peorZonaEn.y > 0.7, "señala la zona donde falta");
});

test("un color distinto se detecta", async () => {
  const a = await pagina(BASE, "#ffffff");
  const b = await pagina(BASE, "#f3d9e4");
  assert.equal((await compararImagenes(a, b)).aprobado, false);
});
