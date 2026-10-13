import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readDesignDocument } from "../document/migrate";
import { renderPdf } from "./pdf";
import { pdfToPng } from "./png-wasm";

/**
 * Un texto girado tiene que quedar **adentro** de su recuadro girado.
 *
 * pdf-lib gira cada línea alrededor de su punto de arranque, no del centro del recuadro. Con
 * giros chicos casi no se nota; a 90° el texto terminaba lejos de donde estaba en pantalla, o
 * fuera de la hoja (la carpeta de San Patricio salió sin los textos verticales del interior).
 */
async function tintaFueraDe(
  png: Uint8Array,
  caja: { x0: number; x1: number; y0: number; y1: number },
): Promise<{ fuera: number; total: number }> {
  const { data, info } = await sharp(Buffer.from(png)).raw().toBuffer({ resolveWithObject: true });
  let fuera = 0;
  let total = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const esRojo = data[i]! > 150 && data[i + 1]! < 110 && data[i + 2]! < 110;
      if (!esRojo) continue;
      total++;
      const fx = x / info.width;
      const fy = y / info.height;
      if (fx < caja.x0 || fx > caja.x1 || fy < caja.y0 || fy > caja.y1) fuera++;
    }
  }
  return { fuera, total };
}

for (const giro of [90, -90, 90.68, -89.65, 180, 30]) {
  test(`un texto girado ${giro}° queda dentro de su recuadro`, async () => {
    // Un recuadro largo y bajo en el centro de la hoja: 80 × 10 mm sobre una hoja de 100 × 100.
    const doc = readDesignDocument({
      schemaVersion: 1,
      metadata: { name: "Texto girado" },
      format: { medium: "PRINT", width: 100, height: 100, dpi: 300, bleedMm: 0, safeAreaMm: 0 },
      sides: [
        {
          id: "frente",
          name: "Frente",
          background: "#ffffff",
          blocks: [
            {
              id: "texto",
              type: "text",
              x: 10,
              y: 45,
              width: 80,
              height: 10,
              rotation: giro,
              fontId: "dmSans",
              fontSize: 14,
              color: "#ff0000",
              align: "center",
              content: "5.º A - Colegio San Patricio",
            },
          ],
        },
      ],
    });
    if (!doc.ok) throw new Error(doc.errors.join(" | "));

    const pdf = await renderPdf(doc.value, { values: {}, omitted: [] }, {
      includeBleed: false,
      resources: { read: async () => null },
    });
    if (!pdf.ok) throw new Error(pdf.errors.join(" | "));
    const png = await pdfToPng(pdf.value, { dpi: 100, pageIndex: 0 });
    if (!png.ok) throw new Error(png.errors.join(" | "));

    // El recuadro girado alrededor de su centro (50, 50), con un margen de 3 mm.
    const rad = (giro * Math.PI) / 180;
    const medioAncho = (Math.abs(40 * Math.cos(rad)) + Math.abs(5 * Math.sin(rad)) + 3) / 100;
    const medioAlto = (Math.abs(40 * Math.sin(rad)) + Math.abs(5 * Math.cos(rad)) + 3) / 100;
    const { fuera, total } = await tintaFueraDe(png.value, {
      x0: 0.5 - medioAncho,
      x1: 0.5 + medioAncho,
      y0: 0.5 - medioAlto,
      y1: 0.5 + medioAlto,
    });
    assert.ok(total > 200, `el texto no se dibujó (${total} píxeles)`);
    assert.ok(fuera < total * 0.01, `el texto se sale de su recuadro: ${fuera} de ${total} píxeles afuera`);
  });
}
