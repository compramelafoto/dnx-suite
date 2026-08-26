import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readDesignDocument } from "../document/migrate";
import { renderPdf } from "./pdf";
import { RENDERER_VERSION } from "./version";
import type { ResourceResolver } from "./resources";

function documentoCarnet() {
  const raw = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../document/__fixtures__/carnet-v1.json", import.meta.url)),
      "utf8",
    ),
  ) as unknown;
  const r = readDesignDocument(raw);
  if (!r.ok) throw new Error(r.errors.join(" | "));
  return r.value;
}

/** PNG de 1×1 píxel, suficiente para probar que la imagen se incrusta. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const recursos: ResourceResolver = {
  read: async (ref) =>
    ref.endsWith(".jpg") || ref.endsWith(".png") ? new Uint8Array(PNG_1X1) : null,
};

const resueltas = {
  values: {
    fullName: "Daniel Cuart",
    memberNumber: "128",
    category: "Activo",
    validUntil: "26/08/2028",
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
    photo: "socios/128/foto.jpg",
  },
  omitted: [] as string[],
};

test("la version del renderizador esta declarada", () => {
  assert.match(RENDERER_VERSION, /^\d+\.\d+\.\d+$/);
});

test("produce un PDF de dos paginas", async () => {
  const r = await renderPdf(documentoCarnet(), resueltas, {
    includeBleed: false,
    resources: recursos,
  });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  const cabecera = Buffer.from(r.value.slice(0, 5)).toString("latin1");
  assert.equal(cabecera, "%PDF-");
  const texto = Buffer.from(r.value).toString("latin1");
  assert.match(texto, /\/Count 2/);
});

test("el PDF cambia de tamano cuando se pide sangrado", async () => {
  const sin = await renderPdf(documentoCarnet(), resueltas, {
    includeBleed: false,
    resources: recursos,
  });
  const con = await renderPdf(documentoCarnet(), resueltas, {
    includeBleed: true,
    resources: recursos,
  });
  assert.equal(sin.ok && con.ok, true);
  if (!sin.ok || !con.ok) return;
  const textoSin = Buffer.from(sin.value).toString("latin1");
  const textoCon = Buffer.from(con.value).toString("latin1");
  assert.match(textoSin, /242\.6/);
  assert.match(textoCon, /259\.6/);
});

test("una imagen que no se puede resolver detiene la emision", async () => {
  const vacio: ResourceResolver = { read: async () => null };
  const r = await renderPdf(documentoCarnet(), resueltas, {
    includeBleed: false,
    resources: vacio,
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /socios\/128\/foto\.jpg/);
});

test("dos renders del mismo documento con los mismos datos dan el mismo archivo", async () => {
  const a = await renderPdf(documentoCarnet(), resueltas, {
    includeBleed: false,
    resources: recursos,
  });
  const b = await renderPdf(documentoCarnet(), resueltas, {
    includeBleed: false,
    resources: recursos,
  });
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.deepEqual(Buffer.from(a.value), Buffer.from(b.value), "el render no es reproducible");
});

import { pdfToPng } from "./png";
import { renderSvgPages } from "./svg";

test("rasteriza la primera cara del PDF a PNG", async () => {
  const pdf = await renderPdf(documentoCarnet(), resueltas, {
    includeBleed: false,
    resources: recursos,
  });
  assert.equal(pdf.ok, true);
  if (!pdf.ok) return;
  const png = await pdfToPng(pdf.value, { dpi: 300, pageIndex: 0 });
  assert.equal(png.ok, true, png.ok ? "" : png.errors.join(" | "));
  if (!png.ok) return;
  assert.deepEqual(Array.from(png.value.slice(0, 4)), [0x89, 0x50, 0x4e, 0x47]);
  assert.ok(png.value.byteLength > 2000);
});

test("pedir una cara que no existe falla con un mensaje claro", async () => {
  const pdf = await renderPdf(documentoCarnet(), resueltas, {
    includeBleed: false,
    resources: recursos,
  });
  assert.equal(pdf.ok, true);
  if (!pdf.ok) return;
  const png = await pdfToPng(pdf.value, { dpi: 300, pageIndex: 7 });
  assert.equal(png.ok, false);
});

test("produce un SVG por cara con el texto ya interpolado", async () => {
  const r = await renderSvgPages(documentoCarnet(), resueltas);
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.value.length, 2);
  assert.match(r.value[0] ?? "", /^<svg /);
  assert.match(r.value[0] ?? "", /Daniel Cuart/);
  assert.match(r.value[0] ?? "", /font-family/);
});

test("el SVG escapa los caracteres que romperian el XML", async () => {
  // Se comprueban los caracteres uno por uno y no la cadena entera: el corte de líneas puede
  // repartirlos en dos <text>, y eso no tiene nada de malo.
  const conAmpersand = { ...resueltas, values: { ...resueltas.values, fullName: "Ana&Co <x>" } };
  const r = await renderSvgPages(documentoCarnet(), conAmpersand);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const svg = r.value[0] ?? "";
  assert.match(svg, /Ana&amp;Co/);
  assert.match(svg, /&lt;x&gt;/);
  assert.doesNotMatch(svg, /Ana&Co/);
});

test("no incrusta un WOFF crudo dentro del PDF", async () => {
  // @fontsource distribuye WOFF, que es un contenedor comprimido. Si se incrusta tal cual,
  // los lectores lo reparan a medias: las letras básicas salen y las acentuadas quedan en
  // cuadraditos. La firma "wOFF" dentro del PDF es la señal de que eso volvió a pasar.
  const r = await renderPdf(documentoCarnet(), resueltas, {
    includeBleed: false,
    resources: recursos,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(
    Buffer.from(r.value).includes("wOFF"),
    false,
    "hay una tipografía WOFF sin convertir dentro del PDF: los acentos van a salir mal",
  );
});

