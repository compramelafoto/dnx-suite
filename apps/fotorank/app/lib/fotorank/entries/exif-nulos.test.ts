import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";

import { extractEntryExif, limpiarNulosProfundo, sinNulos } from "./exif";

test("sinNulos saca el carácter nulo y deja el resto", () => {
  assert.equal(sinNulos("Apple\u0000\u0000"), "Apple");
  assert.equal(sinNulos("sin nada raro"), "sin nada raro");
});

test("limpiarNulosProfundo recorre objetos y listas sin tocar números ni fechas", () => {
  const fecha = new Date("2026-10-09T18:55:00Z");
  const limpio = limpiarNulosProfundo({ a: "x\u0000", b: ["y\u0000", 3], c: fecha, d: { e: "\u0000z" } });
  assert.deepEqual(limpio, { a: "x", b: ["y", 3], c: fecha, d: { e: "z" } });
});

test("en el EXIF clásico exifr ya corta el texto en el primer nulo", async () => {
  const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#808080" } })
    .withExif({ IFD0: { Make: "Apple\u0000Inc", Model: "iPhone 15\u0000\u0000", Software: "\u0000Editor" } })
    .jpeg()
    .toBuffer();
  const exif = await extractEntryExif(jpeg);
  assert.equal(exif.cameraMake, "Apple");
  assert.equal(exif.cameraModel, "iPhone 15");
  assert.equal(exif.software, null);
  assert.ok(!JSON.stringify(exif).includes("\\u0000"), "quedó un nulo en el resultado");
});

test("un nulo dentro del XMP (Lightroom y otros editores) no llega a la base", async () => {
  const xmp =
    '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:aux="http://ns.adobe.com/exif/1.0/aux/" xmlns:tiff="http://ns.adobe.com/tiff/1.0/"' +
    ' aux:LensModel="Lente\u0000X" tiff:Make="Canon\u0000"/></rdf:RDF></x:xmpmeta>';
  const base = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#808080" } }).jpeg().toBuffer();
  // Segmento APP1 de XMP insertado a mano justo después del SOI.
  const payload = Buffer.concat([Buffer.from("http://ns.adobe.com/xap/1.0/\u0000", "latin1"), Buffer.from(xmp, "utf8")]);
  const largo = Buffer.alloc(2);
  largo.writeUInt16BE(payload.length + 2);
  const jpeg = Buffer.concat([base.subarray(0, 2), Buffer.from([0xff, 0xe1]), largo, payload, base.subarray(2)]);
  const exif = await extractEntryExif(jpeg);
  assert.equal(exif.lensModel, "LenteX");
  assert.ok(!JSON.stringify(exif).includes("\\u0000"), "quedó un nulo en el resultado");
});
