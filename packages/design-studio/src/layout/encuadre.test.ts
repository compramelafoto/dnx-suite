import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readDesignDocument } from "../document/migrate";
import { renderPdf } from "../render/pdf";
import { pdfToPng } from "../render/png-wasm";
import { renderSvgPages } from "../render/svg";
import { normalizarEncuadre, ubicarFotoEncuadrada } from "./encuadre";

test("sin zoom ni corrimiento, la foto cubre el recuadro centrada", () => {
  // Foto 4:1 en un recuadro cuadrado de 100: queda de 400 × 100, corrida 150 a la izquierda.
  const u = ubicarFotoEncuadrada({ anchoRecuadro: 100, altoRecuadro: 100, aspectoFoto: 4, crop: { zoom: 1, x: 0, y: 0 } });
  assert.deepEqual(u, { x: -150, y: 0, width: 400, height: 100 });
});

test("x = -1 pega el borde izquierdo de la foto; x = 1, el derecho", () => {
  const base = { anchoRecuadro: 100, altoRecuadro: 100, aspectoFoto: 4 };
  assert.equal(ubicarFotoEncuadrada({ ...base, crop: { zoom: 1, x: -1, y: 0 } }).x, 0);
  assert.equal(ubicarFotoEncuadrada({ ...base, crop: { zoom: 1, x: 1, y: 0 } }).x, -300);
});

test("el zoom agranda alrededor del centro", () => {
  const u = ubicarFotoEncuadrada({ anchoRecuadro: 100, altoRecuadro: 100, aspectoFoto: 1, crop: { zoom: 2, x: 0, y: 0 } });
  assert.deepEqual(u, { x: -50, y: -50, width: 200, height: 200 });
});

test("normaliza: recorta valores fuera de rango y descarta el encuadre neutro", () => {
  assert.deepEqual(normalizarEncuadre({ zoom: 9, x: -3, y: 0.5 }), { zoom: 4, x: -1, y: 0.5 });
  assert.equal(normalizarEncuadre({ zoom: 1, x: 0, y: 0 }), null);
  assert.equal(normalizarEncuadre("cualquier cosa"), null);
});

/** Mitad izquierda roja, mitad derecha azul. */
async function fotoRojaYAzul(): Promise<Uint8Array> {
  const mitad = (r: number, b: number) =>
    sharp({ create: { width: 600, height: 300, channels: 3, background: { r, g: 0, b } } }).png().toBuffer();
  const png = await sharp({ create: { width: 1200, height: 300, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([
      { input: await mitad(255, 0), left: 0, top: 0 },
      { input: await mitad(0, 255), left: 600, top: 0 },
    ])
    .png()
    .toBuffer();
  return new Uint8Array(png);
}

function documento(crop: unknown) {
  const r = readDesignDocument({
    schemaVersion: 1,
    metadata: { name: "Encuadre" },
    format: { medium: "PRINT", width: 100, height: 100, dpi: 300, bleedMm: 0, safeAreaMm: 0 },
    sides: [
      {
        id: "frente",
        name: "Frente",
        background: "#ffffff",
        blocks: [
          { id: "foto", type: "image", x: 40, y: 40, width: 20, height: 20, variableKey: "photo", fit: "cover", mask: "rect", crop, sourceAspect: 4 },
        ],
      },
    ],
  });
  if (!r.ok) throw new Error(r.errors.join(" | "));
  return r.value;
}

/** Cuántos píxeles rojos y azules hay dentro del recuadro. */
async function coloresEnElRecuadro(crop: unknown): Promise<{ rojo: number; azul: number }> {
  const foto = await fotoRojaYAzul();
  const pdf = await renderPdf(documento(crop), { values: { photo: "foto.png" }, omitted: [] }, {
    includeBleed: false,
    resources: { read: async () => foto },
  });
  if (!pdf.ok) throw new Error(pdf.errors.join(" | "));
  const png = await pdfToPng(pdf.value, { dpi: 150, pageIndex: 0 });
  if (!png.ok) throw new Error(png.errors.join(" | "));
  const { data, info } = await sharp(Buffer.from(png.value)).raw().toBuffer({ resolveWithObject: true });
  const desde = Math.ceil(info.width * 0.41);
  const hasta = Math.floor(info.width * 0.59);
  let rojo = 0;
  let azul = 0;
  for (let y = desde; y < hasta; y++) {
    for (let x = desde; x < hasta; x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i]! > 180 && data[i + 2]! < 80) rojo++;
      if (data[i + 2]! > 180 && data[i]! < 80) azul++;
    }
  }
  return { rojo, azul };
}

test("en el PDF, la foto corrida a la izquierda muestra su lado izquierdo", async () => {
  const izquierda = await coloresEnElRecuadro({ zoom: 1, x: -1, y: 0 });
  assert.ok(izquierda.rojo > 0 && izquierda.azul === 0, `esperaba sólo rojo: ${JSON.stringify(izquierda)}`);
  const derecha = await coloresEnElRecuadro({ zoom: 1, x: 1, y: 0 });
  assert.ok(derecha.azul > 0 && derecha.rojo === 0, `esperaba sólo azul: ${JSON.stringify(derecha)}`);
});

test("la vista SVG ubica la foto encuadrada y la recorta con el recuadro", async () => {
  const r = await renderSvgPages(documento({ zoom: 1, x: -1, y: 0 }), { values: { photo: "foto.png" }, omitted: [] });
  if (!r.ok) throw new Error(r.errors.join(" | "));
  const svg = r.value[0]!;
  assert.match(svg, /<clipPath id="clip-foto"><rect /);
  assert.match(svg, /preserveAspectRatio="none"/);
});
