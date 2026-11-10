import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { containPhotoZoom } from "@repo/template-editor-core";
import { cropPhotoForSlot } from "./recorte-de-foto";

/** Una grupal apaisada de prueba: toda roja, para distinguirla del borde blanco. */
async function grupalApaisada(): Promise<Uint8Array> {
  const buf = await sharp({ create: { width: 600, height: 400, channels: 3, background: { r: 220, g: 30, b: 30 } } })
    .jpeg({ quality: 95 })
    .toBuffer();
  return new Uint8Array(buf);
}

async function pixel(img: Uint8Array, x: number, y: number) {
  const { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! };
}

const esBlanco = (p: { r: number; g: number; b: number }) => p.r > 240 && p.g > 240 && p.b > 240;
const esRojo = (p: { r: number; g: number; b: number }) => p.r > 180 && p.g < 80 && p.b < 80;

test("grupal apaisada alejada en un hueco vertical: sale entera, con bordes blancos arriba y abajo", async () => {
  const slot = { slotWidth: 1649, slotHeight: 2493 };
  const zoom = containPhotoZoom({ srcWidth: 600, srcHeight: 400, ...slot });
  const out = await cropPhotoForSlot({ bytes: await grupalApaisada(), ...slot, crop: { zoom, x: 0, y: 0 } });
  const meta = await sharp(out).metadata();
  // Misma proporción que el hueco (no se deforma al ponerla en el diseño).
  assert.ok(Math.abs(meta.width! / meta.height! - 1649 / 2493) < 0.01, `${meta.width}x${meta.height}`);
  // Sin agrandar: el ancho es el de la foto.
  assert.equal(meta.width, 600);
  // Arriba y abajo, blanco; en el medio, la foto; a los costados del medio, la foto entera.
  assert.ok(esBlanco(await pixel(out, 300, 5)));
  assert.ok(esBlanco(await pixel(out, 300, meta.height! - 5)));
  assert.ok(esRojo(await pixel(out, 300, Math.round(meta.height! / 2))));
  assert.ok(esRojo(await pixel(out, 3, Math.round(meta.height! / 2))));
  assert.ok(esRojo(await pixel(out, 596, Math.round(meta.height! / 2))));
});

test("con y = -1 la foto alejada queda pegada arriba", async () => {
  const slot = { slotWidth: 1000, slotHeight: 1500 };
  const zoom = containPhotoZoom({ srcWidth: 600, srcHeight: 400, ...slot });
  const out = await cropPhotoForSlot({ bytes: await grupalApaisada(), ...slot, crop: { zoom, x: 0, y: -1 } });
  const meta = await sharp(out).metadata();
  assert.ok(esRojo(await pixel(out, 300, 3)));
  assert.ok(esBlanco(await pixel(out, 300, meta.height! - 3)));
});

test("sin alejar (zoom 1) se recorta como siempre, sin bordes", async () => {
  const out = await cropPhotoForSlot({
    bytes: await grupalApaisada(),
    slotWidth: 1000,
    slotHeight: 1500,
    crop: { zoom: 1, x: 0, y: 0 },
  });
  const meta = await sharp(out).metadata();
  assert.ok(Math.abs(meta.width! / meta.height! - 1000 / 1500) < 0.01);
  assert.ok(esRojo(await pixel(out, 2, 2)));
  assert.ok(esRojo(await pixel(out, meta.width! - 2, meta.height! - 2)));
});
