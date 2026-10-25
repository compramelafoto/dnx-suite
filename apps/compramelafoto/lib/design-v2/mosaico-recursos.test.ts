import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { courseMosaicForPrint } from "./values";
import { leerRecursoDelMosaico } from "./mosaico-recursos";

const jpg = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#336699" } }).jpeg().toBuffer().then((b) => new Uint8Array(b));

test("sin compañeros guardados, la carpeta real no lleva ninguno (nunca la muestra)", () => {
  assert.deepEqual(courseMosaicForPrint({}), []);
  assert.deepEqual(courseMosaicForPrint({ "course.mosaic": "{roto" }), []);
  assert.equal(courseMosaicForPrint({ "course.mosaic": JSON.stringify([{ firstName: "Ana", lastName: "Paz" }]) }).length, 1);
});

test("una referencia que no es del mosaico no se toca", async () => {
  assert.equal(await leerRecursoDelMosaico("https://otra.cosa/logo.png", { cargarFoto: async () => null, cargarUrl: async () => null }), undefined);
});

test("la foto del álbum se achica a 1200 px de lado mayor", async () => {
  const bytes = await leerRecursoDelMosaico("mosaic-photo:7", {
    cargarFoto: async (id) => (id === 7 ? jpg(3000, 4000) : null),
    cargarUrl: async () => null,
  });
  const meta = await sharp(bytes!).metadata();
  assert.equal(Math.max(meta.width!, meta.height!), 1200);
});

test("la foto por dirección también se achica", async () => {
  const bytes = await leerRecursoDelMosaico("mosaic-url:https://r2.example/a.jpg", {
    cargarFoto: async () => null,
    cargarUrl: async (url) => (url === "https://r2.example/a.jpg" ? jpg(2400, 1800) : null),
  });
  const meta = await sharp(bytes!).metadata();
  assert.equal(Math.max(meta.width!, meta.height!), 1200);
});

test("si la foto no aparece, va la silueta gris y la carpeta se imprime igual", async () => {
  const deps = { cargarFoto: async () => null, cargarUrl: async () => { throw new Error("red caída"); } };
  for (const ref of ["mosaic-photo:7", "mosaic-url:https://r2.example/a.jpg", "mosaic-photo:abc"]) {
    const bytes = await leerRecursoDelMosaico(ref, deps);
    assert.ok(bytes && bytes.length > 0, ref);
    const meta = await sharp(bytes!).metadata();
    assert.ok(meta.width! > 0);
  }
});

test("una foto rota (bytes que no son imagen) también da la silueta", async () => {
  const bytes = await leerRecursoDelMosaico("mosaic-photo:7", {
    cargarFoto: async () => new Uint8Array([1, 2, 3]),
    cargarUrl: async () => null,
  });
  assert.ok((await sharp(bytes!).metadata()).width! > 0);
});
