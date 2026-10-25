import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { densidadDeJpg, jpgConDensidad } from "./jpg-imprenta";

/** Un JPG como los que escribe sharp sin metadatos: sin encabezado JFIF ni marca de dpi. */
async function jpgDePrueba(): Promise<Uint8Array> {
  const buf = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 40, b: 90 } } })
    .jpeg({ quality: 90 })
    .toBuffer();
  return new Uint8Array(buf);
}

async function pixeles(b: Uint8Array): Promise<Buffer> {
  return sharp(b).raw().toBuffer();
}

test("a un JPG sin marca de dpi le agrega 300 sin tocar la imagen", async () => {
  const original = await jpgDePrueba();
  assert.equal(densidadDeJpg(original), null);
  assert.equal((await sharp(original).metadata()).density, 72);
  const marcado = jpgConDensidad(original, 300);
  assert.equal(densidadDeJpg(marcado), 300);
  assert.equal((await sharp(marcado).metadata()).density, 300);
  assert.ok((await pixeles(marcado)).equals(await pixeles(original)));
  // El original no se modifica.
  assert.equal(densidadDeJpg(original), null);
});

test("un JPG que ya dice 72 dpi se corrige en el lugar, con el mismo tamaño", async () => {
  const a72 = jpgConDensidad(await jpgDePrueba(), 72);
  assert.equal((await sharp(a72).metadata()).density, 72);
  const a300 = jpgConDensidad(a72, 300);
  assert.equal(a300.length, a72.length);
  assert.equal((await sharp(a300).metadata()).density, 300);
  assert.ok((await pixeles(a300)).equals(await pixeles(a72)));
});

test("si ya está en 300 devuelve lo mismo; si no es JPG no lo toca", async () => {
  const marcado = jpgConDensidad(await jpgDePrueba(), 300);
  assert.equal(jpgConDensidad(marcado, 300), marcado);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  assert.equal(jpgConDensidad(png, 300), png);
});
