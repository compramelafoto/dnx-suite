import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readDesignDocument } from "../document/migrate";
import { renderPdf } from "./pdf";
import { pdfToPng } from "./png-wasm";
import type { ResourceResolver } from "./resources";

/**
 * El test que faltó dos veces.
 *
 * Antes se daba por buena una prueba que sólo miraba "¿se dibujó algo?". Eso no distingue entre
 * usar la tipografía del diseño y usar cualquiera del sistema, y por eso pasaron dos arreglos
 * que no arreglaban nada. Este mide el **ancho** del texto: una condensada y una ancha ocupan
 * distinto, así que si el rasterizado respeta la tipografía, los anchos difieren; si la ignora,
 * dan igual.
 */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const recursos: ResourceResolver = { read: async () => new Uint8Array(PNG_1X1) };

/**
 * Un documento mínimo: una sola línea de texto negro sobre blanco.
 *
 * Con el carnet no servía: tiene fondos y adornos que llegan al borde, así que el ancho de la
 * tinta era siempre el de la hoja y las dos tipografías medían igual. El test parecía detectar
 * un problema que no existía.
 */
function documentoDeUnaLinea(fontId: string) {
  const raw = {
    schemaVersion: 1,
    metadata: { name: "Prueba de tipografía" },
    format: { medium: "PRINT", width: 200, height: 40, dpi: 300, bleedMm: 0, safeAreaMm: 0 },
    sides: [
      {
        id: "frente",
        name: "Frente",
        background: "#ffffff",
        blocks: [
          {
            id: "linea",
            type: "text",
            x: 2,
            y: 10,
            width: 196,
            height: 20,
            fontId,
            fontSize: 24,
            fontWeight: "bold",
            color: "#000000",
            align: "left",
            content: "{{fullName}}",
          },
        ],
      },
    ],
  };
  const r = readDesignDocument(raw);
  if (!r.ok) throw new Error(r.errors.join(" | "));
  return r.value;
}

const resueltas = {
  values: {
    fullName: "BIENVENIDO A CLICKATON",
    memberNumber: "128",
    category: "Activo",
    validUntil: "26/08/2028",
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
    photo: "socios/128/foto.jpg",
  },
  omitted: [] as string[],
};

/** Hasta qué columna llega la tinta. Dos tipografías distintas dan anchos distintos. */
async function anchoDeLaTinta(png: Uint8Array): Promise<number> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(Buffer.from(png)).greyscale().raw().toBuffer({
    resolveWithObject: true,
  });
  let maxX = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const v = data[y * info.width + x]!;
      if (v < 100 && x > maxX) maxX = x;
    }
  }
  return maxX;
}

async function rasterizar(fontId: string): Promise<Uint8Array> {
  const pdf = await renderPdf(documentoDeUnaLinea(fontId), resueltas, {
    includeBleed: false,
    resources: recursos,
  });
  if (!pdf.ok) throw new Error(pdf.errors.join(" | "));
  const png = await pdfToPng(pdf.value, { dpi: 150, pageIndex: 0 });
  if (!png.ok) throw new Error(png.errors.join(" | "));
  return png.value;
}

test("respeta la tipografía del diseño, no una cualquiera del sistema", async () => {
  const [condensada, ancha] = await Promise.all([
    rasterizar("barlowCondensed").then(anchoDeLaTinta),
    rasterizar("merriweather").then(anchoDeLaTinta),
  ]);

  assert.notEqual(
    condensada,
    ancha,
    "los dos anchos dan igual: el rasterizado está ignorando la tipografía incrustada",
  );
  assert.ok(
    Math.abs(condensada - ancha) > 20,
    `los anchos casi no difieren (${condensada} vs ${ancha}): sospechoso`,
  );
});

test("rasteriza a las medidas que pide el dpi", async () => {
  const png = await rasterizar("dmSans");
  const b = Buffer.from(png);
  assert.ok(b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), "no es un PNG");
  assert.ok(b.readUInt32BE(16) > 100, "ancho inesperado");
});
