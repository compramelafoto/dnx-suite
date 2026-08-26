import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
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

/**
 * Descomprime cada flujo del PDF y devuelve los primeros bytes de cada uno. Es la única
 * forma de mirar la tipografía realmente incrustada: el flujo va comprimido, así que buscar
 * la firma "wOFF" sobre el archivo crudo no encuentra nada ni cuando el problema está.
 */
function firmasDeLosFlujos(pdf: Uint8Array): string[] {
  const crudo = Buffer.from(pdf);
  const firmas: string[] = [];
  let desde = 0;
  for (;;) {
    const inicio = crudo.indexOf("stream", desde);
    if (inicio === -1) break;
    // "stream" también aparece dentro de "endstream": saltearlo o el recorrido se
    // desalinea y no encuentra ningún flujo.
    if (crudo.subarray(inicio - 3, inicio).toString("latin1") === "end") {
      desde = inicio + 6;
      continue;
    }
    let p = inicio + "stream".length;
    if (crudo[p] === 0x0d) p++;
    if (crudo[p] === 0x0a) p++;
    const fin = crudo.indexOf("endstream", p);
    if (fin === -1) break;
    try {
      const datos = inflateSync(crudo.subarray(p, fin));
      firmas.push(datos.subarray(0, 4).toString("latin1"));
    } catch {
      // Flujo sin comprimir o con otro filtro: no es una tipografía incrustada por pdf-lib.
    }
    desde = fin + 1;
  }
  return firmas;
}

test("la tipografia incrustada es un SFNT valido y no un WOFF", async () => {
  // Este es el defecto que se vio en el primer carnet emitido: "Escane[] este c[]digo".
  // @fontsource distribuye WOFF, que es un contenedor comprimido. Si se incrusta tal cual,
  // el lector lo repara a medias y las letras acentuadas quedan en cuadraditos.
  const r = await renderPdf(documentoCarnet(), resueltas, {
    includeBleed: false,
    resources: recursos,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const firmas = firmasDeLosFlujos(r.value);
  assert.ok(firmas.length > 0, "no se pudo descomprimir ningún flujo del PDF");
  assert.equal(
    firmas.includes("wOFF"),
    false,
    "hay una tipografía WOFF sin convertir dentro del PDF: los acentos van a salir mal",
  );
  // Y que efectivamente haya una tipografía: si no hubiera ninguna, la comprobación de
  // arriba pasaría por vacía.
  const sfnt = firmas.filter((f) => f === "\u0000\u0001\u0000\u0000" || f === "true" || f === "OTTO");
  assert.ok(sfnt.length > 0, `no se encontró ninguna tipografía SFNT; firmas: ${firmas.join(", ")}`);
});


