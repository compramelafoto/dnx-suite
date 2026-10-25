import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { parseDesignDocument } from "../document/parse";
import { renderPdf } from "../render/pdf";
import { pdfToPng } from "../render/png-wasm";
import { buildLayoutPlan, desplazamientoVertical, type LayoutTextItem, type TextMeasurer } from "./plan";

/**
 * Alineación vertical del texto dentro de su caja: arriba (lo de siempre), centro o abajo.
 *
 * Existe por el listado del curso de la carpeta de San Patricio: la caja es más alta que la
 * lista y los nombres quedaban pegados a un lado, con un hueco vacío del otro.
 */

const medidor: TextMeasurer = { widthOf: (t, _f, _s, sizePt) => t.length * sizePt * 0.5 };

function bloque(extra: Record<string, unknown>) {
  return {
    id: "t",
    type: "text",
    x: 10,
    y: 10,
    width: 80,
    height: 40,
    fontId: "dmSans",
    fontSize: 10,
    color: "#000000",
    content: "Uno",
    ...extra,
  };
}

function documento(extra: Record<string, unknown>) {
  const doc = parseDesignDocument({
    schemaVersion: 1,
    metadata: { name: "Alineación vertical" },
    format: { medium: "PRINT", width: 100, height: 100, dpi: 300, bleedMm: 0, safeAreaMm: 0 },
    sides: [{ id: "a", name: "A", background: "#ffffff", blocks: [bloque(extra)] }],
  });
  if (!doc.ok) throw new Error(doc.errors.join(" | "));
  return doc.value;
}

function item(extra: Record<string, unknown>): LayoutTextItem {
  const plan = buildLayoutPlan(documento(extra), { values: {}, omitted: [] }, {
    measurer: medidor,
    includeBleed: false,
  });
  if (!plan.ok) throw new Error(plan.errors.join(" | "));
  return plan.value.pages[0]!.items[0] as LayoutTextItem;
}

test("la cuenta: arriba no baja nada, centro reparte el hueco y abajo lo pone todo arriba", () => {
  assert.equal(desplazamientoVertical(100, 40, undefined), 0);
  assert.equal(desplazamientoVertical(100, 40, "top"), 0);
  assert.equal(desplazamientoVertical(100, 40, "middle"), 30);
  assert.equal(desplazamientoVertical(100, 40, "bottom"), 60);
});

test("un texto más alto que la caja desborda como en el navegador", () => {
  // Centrado: sobra por los dos lados por igual. Abajo: sobra hacia arriba.
  assert.equal(desplazamientoVertical(40, 100, "middle"), -30);
  assert.equal(desplazamientoVertical(40, 100, "bottom"), -60);
  assert.equal(desplazamientoVertical(40, 100, "top"), 0);
});

test("un documento sin la propiedad se lee y se dibuja arriba, como antes", () => {
  const doc = documento({});
  const leido = doc.sides[0]!.blocks[0] as Record<string, unknown>;
  assert.equal("verticalAlign" in leido, false);
  const it = item({});
  assert.equal(it.verticalAlign, "top");
  assert.equal(it.offsetYPt, 0);
});

test("un valor desconocido se trata como arriba", () => {
  const doc = documento({ verticalAlign: "MEDIO" });
  assert.equal("verticalAlign" in (doc.sides[0]!.blocks[0] as Record<string, unknown>), false);
});

test("centro y abajo usan renglones por interlineado, en puntos", () => {
  const altoCajaPt = (40 * 72) / 25.4;
  // Dos renglones de cuerpo 10 con interlineado 1,5: 30 pt de texto.
  const centro = item({ verticalAlign: "middle", content: "Uno\nDos", lineHeight: 1.5 });
  assert.equal(centro.lines.length, 2);
  assert.ok(Math.abs(centro.offsetYPt - (altoCajaPt - 30) / 2) < 1e-9);
  const abajo = item({ verticalAlign: "bottom", content: "Uno\nDos", lineHeight: 1.5 });
  assert.ok(Math.abs(abajo.offsetYPt - (altoCajaPt - 30)) < 1e-9);
});

test("con el texto achicado para entrar, se centra con el cuerpo achicado", () => {
  // Diez renglones de cuerpo 20 no entran en 40 mm (113 pt): el texto se achica.
  const contenido = Array.from({ length: 10 }, (_, i) => `R${i}`).join("\n");
  const it = item({ verticalAlign: "middle", content: contenido, fontSize: 20 });
  assert.ok(it.sizePt < 20, `no se achicó (${it.sizePt})`);
  const altoCajaPt = (40 * 72) / 25.4;
  const altoTexto = it.lines.length * it.lineHeightPt;
  assert.ok(altoTexto <= altoCajaPt + 0.01);
  assert.ok(Math.abs(it.offsetYPt - (altoCajaPt - altoTexto) / 2) < 1e-9);
});

/** Centro de la tinta roja de la página, en fracciones del ancho y del alto. */
async function centroDeTinta(png: Uint8Array): Promise<{ x: number; y: number; total: number }> {
  const { data, info } = await sharp(Buffer.from(png)).raw().toBuffer({ resolveWithObject: true });
  let sx = 0;
  let sy = 0;
  let total = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i]! > 150 && data[i + 1]! < 110 && data[i + 2]! < 110) {
        sx += x;
        sy += y;
        total++;
      }
    }
  }
  return { x: sx / total / info.width, y: sy / total / info.height, total };
}

async function tintaDe(extra: Record<string, unknown>) {
  // Una caja de 80 × 30 mm en el centro de la hoja, con un texto de una línea.
  const doc = documento({
    x: 10,
    y: 35,
    width: 80,
    height: 30,
    fontSize: 14,
    color: "#ff0000",
    align: "center",
    content: "Colegio San Patricio",
    ...extra,
  });
  const pdf = await renderPdf(doc, { values: {}, omitted: [] }, {
    includeBleed: false,
    resources: { read: async () => null },
  });
  if (!pdf.ok) throw new Error(pdf.errors.join(" | "));
  const png = await pdfToPng(pdf.value, { dpi: 100, pageIndex: 0 });
  if (!png.ok) throw new Error(png.errors.join(" | "));
  const c = await centroDeTinta(png.value);
  assert.ok(c.total > 200, `el texto no se dibujó (${c.total} píxeles)`);
  return c;
}

test("en el PDF, sin giro: arriba, centro y abajo caen donde corresponde", async () => {
  const arriba = await tintaDe({});
  const centro = await tintaDe({ verticalAlign: "middle" });
  const abajo = await tintaDe({ verticalAlign: "bottom" });
  // La caja va de 35 a 65 mm: el centro queda en 50 mm.
  assert.ok(Math.abs(centro.y - 0.5) < 0.01, `centro en ${centro.y}`);
  assert.ok(arriba.y < 0.42, `arriba en ${arriba.y}`);
  assert.ok(abajo.y > 0.58, `abajo en ${abajo.y}`);
  assert.ok(Math.abs(centro.x - 0.5) < 0.01);
});

test("en el PDF, girado 90°: la alineación es en el marco de la caja, no de la hoja", async () => {
  // Girada 90° en sentido horario, la parte de arriba de las letras mira a la derecha de la hoja.
  const arriba = await tintaDe({ rotation: 90 });
  const centro = await tintaDe({ rotation: 90, verticalAlign: "middle" });
  const abajo = await tintaDe({ rotation: 90, verticalAlign: "bottom" });
  assert.ok(Math.abs(centro.x - 0.5) < 0.01, `centro en x=${centro.x}`);
  assert.ok(Math.abs(centro.y - 0.5) < 0.01, `centro en y=${centro.y}`);
  assert.ok(arriba.x > 0.58, `arriba en x=${arriba.x}`);
  assert.ok(abajo.x < 0.42, `abajo en x=${abajo.x}`);
});
