import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checksumOf, emitDesign } from "./emit";
import { RENDERER_VERSION } from "../render/version";
import type { VariableContract } from "../variables/contract";
import type { ResourceResolver } from "../render/resources";

const documentoCrudo = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../document/__fixtures__/carnet-v1.json", import.meta.url)),
    "utf8",
  ),
) as unknown;

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const recursos: ResourceResolver = { read: async () => new Uint8Array(PNG_1X1) };

const contrato: VariableContract = {
  variables: [
    { key: "fullName", type: "text", label: "Nombre completo", required: true, sampleValue: "Daniel Cuart", maxLength: 34 },
    { key: "memberNumber", type: "number", label: "Número de socio", required: true, sampleValue: "128", decimals: 0 },
    { key: "category", type: "text", label: "Categoría", required: false, sampleValue: "Activo" },
    { key: "validUntil", type: "date", label: "Vigente hasta", required: true, sampleValue: "2028-08-26", dateFormat: "es-AR-short" },
    { key: "verificationUrl", type: "qrPayload", label: "Enlace de verificación", required: true, sampleValue: "https://fotoffice.com/c/AB12CD34" },
    { key: "photo", type: "image", label: "Foto del socio", required: true, sampleValue: "socios/ejemplo/foto.jpg" },
  ],
};

const datos = {
  fullName: "Daniel Cuart",
  memberNumber: 128,
  validUntil: new Date(Date.UTC(2028, 7, 26)),
  verificationUrl: "https://fotoffice.com/c/AB12CD34",
  photo: "socios/128/foto.jpg",
};

test("el checksum es estable y cambia con el contenido", () => {
  const a = checksumOf(new Uint8Array([1, 2, 3]));
  assert.equal(a, checksumOf(new Uint8Array([1, 2, 3])));
  assert.notEqual(a, checksumOf(new Uint8Array([1, 2, 4])));
  assert.equal(a.length, 64);
});

test("emite el PDF, los PNG de cada cara y registra que hace falta para reproducirlo", async () => {
  const r = await emitDesign({
    document: documentoCrudo,
    contract: contrato,
    values: datos,
    formats: ["PDF", "PNG_PER_SIDE"],
    includeBleed: true,
    pngDpi: 300,
    resources: recursos,
    fileBaseName: "carnet-128",
  });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.rendererVersion, RENDERER_VERSION);
  assert.equal(r.schemaVersion, 1);
  assert.deepEqual(r.omittedVariables, ["category"]);
  // La fecha se guarda ya formateada: es el texto que quedó impreso.
  assert.equal(r.resolvedValues.validUntil, "26/08/2028");
  const nombres = r.files.map((f) => f.name).sort();
  assert.deepEqual(nombres, ["carnet-128-dorso.png", "carnet-128-frente.png", "carnet-128.pdf"]);
  for (const f of r.files) {
    assert.equal(f.checksum.length, 64);
    assert.ok(f.bytes.byteLength > 0);
  }
});

test("emite el SVG de cada cara cuando se lo pide", async () => {
  const r = await emitDesign({
    document: documentoCrudo,
    contract: contrato,
    values: datos,
    formats: ["SVG_PER_SIDE"],
    resources: recursos,
    fileBaseName: "carnet-128",
  });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.files.length, 2);
  assert.equal(r.files[0]?.contentType, "image/svg+xml");
});

test("un dato obligatorio ausente detiene la emision antes de dibujar nada", async () => {
  const r = await emitDesign({
    document: documentoCrudo,
    contract: contrato,
    values: { ...datos, fullName: "" },
    formats: ["PDF"],
    resources: recursos,
    fileBaseName: "carnet-128",
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /Nombre completo/);
});

test("un documento que no se entiende detiene la emision", async () => {
  const r = await emitDesign({
    document: { schemaVersion: 99 },
    contract: contrato,
    values: datos,
    formats: ["PDF"],
    resources: recursos,
    fileBaseName: "carnet-128",
  });
  assert.equal(r.ok, false);
});

test("la misma emision repetida da los mismos checksums", async () => {
  const pedido = {
    document: documentoCrudo,
    contract: contrato,
    values: datos,
    resources: recursos,
    fileBaseName: "carnet-128",
  };
  const a = await emitDesign({ ...pedido, formats: ["PDF"] });
  const b = await emitDesign({ ...pedido, formats: ["PDF"] });
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.equal(a.files[0]?.checksum, b.files[0]?.checksum);
});
