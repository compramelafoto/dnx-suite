import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readDesignDocument } from "../document/migrate";
import { renderPdf } from "./pdf";
import { pdfToPng } from "./png-wasm";
import type { ResourceResolver } from "./resources";

/**
 * Una foto tiene que quedar **adentro** de su recuadro.
 *
 * Con "llenar el recuadro" la imagen se agranda hasta cubrirlo y lo que sobra se recorta. El
 * recorte sólo se aplicaba a las formas redondas: en un recuadro común la foto se dibujaba
 * entera y se salía por los costados, tapando el marco que la rodeaba.
 */
async function imagenRoja(width: number, height: number): Promise<Uint8Array> {
  const png = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(png);
}

function documentoConFotoEnElCentro() {
  const r = readDesignDocument({
    schemaVersion: 1,
    metadata: { name: "Recorte" },
    format: { medium: "PRINT", width: 100, height: 100, dpi: 300, bleedMm: 0, safeAreaMm: 0 },
    sides: [
      {
        id: "frente",
        name: "Frente",
        background: "#ffffff",
        blocks: [
          {
            id: "foto",
            // Un recuadro chico y cuadrado en el medio de la hoja.
            type: "image",
            x: 40,
            y: 40,
            width: 20,
            height: 20,
            variableKey: "photo",
            fit: "cover",
            mask: "rect",
          },
        ],
      },
    ],
  });
  if (!r.ok) throw new Error(r.errors.join(" | "));
  return r.value;
}

/** Cuántos píxeles rojos hay fuera del recuadro donde va la foto. */
async function rojoFueraDelRecuadro(png: Uint8Array): Promise<number> {
  const { data, info } = await sharp(Buffer.from(png)).raw().toBuffer({
    resolveWithObject: true,
  });
  // El recuadro ocupa del 40% al 60% de la hoja, en los dos ejes.
  const desde = Math.floor(info.width * 0.4);
  const hasta = Math.ceil(info.width * 0.6);
  let fuera = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const esRojo = data[i]! > 180 && data[i + 1]! < 80 && data[i + 2]! < 80;
      const adentro = x >= desde && x <= hasta && y >= desde && y <= hasta;
      if (esRojo && !adentro) fuera++;
    }
  }
  return fuera;
}

test("una foto que llena su recuadro no se sale de él", async () => {
  // Imagen bien apaisada: al llenar un recuadro cuadrado, sobra muchísimo a los costados.
  const foto = await imagenRoja(1200, 300);
  const recursos: ResourceResolver = { read: async () => foto };

  const pdf = await renderPdf(
    documentoConFotoEnElCentro(),
    { values: { photo: "foto.png" }, omitted: [] },
    { includeBleed: false, resources: recursos },
  );
  if (!pdf.ok) throw new Error(pdf.errors.join(" | "));

  const png = await pdfToPng(pdf.value, { dpi: 150, pageIndex: 0 });
  if (!png.ok) throw new Error(png.errors.join(" | "));

  const fuera = await rojoFueraDelRecuadro(png.value);
  assert.ok(
    fuera < 200,
    `la foto se sale del recuadro: ${fuera} píxeles suyos quedaron afuera`,
  );
});

/**
 * Con el bloque girado, el recorte tiene que girar con él. Es el caso real de las placas: el
 * marco está inclinado unos grados y la foto va adentro.
 */
test("una foto girada tampoco se sale de su recuadro", async () => {
  const foto = await imagenRoja(1200, 300);
  const recursos: ResourceResolver = { read: async () => foto };

  const doc = readDesignDocument({
    schemaVersion: 1,
    metadata: { name: "Recorte girado" },
    format: { medium: "PRINT", width: 100, height: 100, dpi: 300, bleedMm: 0, safeAreaMm: 0 },
    sides: [
      {
        id: "frente",
        name: "Frente",
        background: "#ffffff",
        blocks: [
          {
            id: "foto",
            type: "image",
            x: 40,
            y: 40,
            width: 20,
            height: 20,
            rotation: -7,
            variableKey: "photo",
            fit: "cover",
            mask: "rect",
          },
        ],
      },
    ],
  });
  if (!doc.ok) throw new Error(doc.errors.join(" | "));

  const pdf = await renderPdf(doc.value, { values: { photo: "foto.png" }, omitted: [] }, {
    includeBleed: false,
    resources: recursos,
  });
  if (!pdf.ok) throw new Error(pdf.errors.join(" | "));

  const png = await pdfToPng(pdf.value, { dpi: 150, pageIndex: 0 });
  if (!png.ok) throw new Error(png.errors.join(" | "));

  /*
   * Girado, el recuadro asoma apenas fuera del cuadrado que se mide, así que el margen es más
   * holgado que en el test sin giro. Lo que importa es que no queden miles de píxeles sueltos,
   * que es lo que pasaba cuando la imagen se dibujaba entera.
   */
  const fuera = await rojoFueraDelRecuadro(png.value);
  assert.ok(fuera < 3000, `la foto girada se sale del recuadro: ${fuera} píxeles afuera`);
});
