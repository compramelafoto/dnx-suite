import { test } from "node:test";
import assert from "node:assert/strict";
import { mmToPt } from "../document/units";
import { evaluateQrLegibility } from "./qr";

const TOKEN_CORTO = "https://fotoffice.com/c/AB12CD34";

test("un QR de 26 mm con un token corto es legible", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "OK");
  assert.ok(r.moduleSizeMm && r.moduleSizeMm > 0.5);
});

test("el mismo QR en 8 mm bloquea la publicacion", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(8),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "BLOCKS_PUBLISH");
  assert.match(r.message, /chico|pequeñ/i);
});

test("un tamano intermedio avisa sin bloquear", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(19),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "WARNING");
});

test("mas informacion codificada empeora la legibilidad en el mismo tamano", () => {
  const corto = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  const largo = evaluateQrLegibility({
    payload:
      "https://fotoffice.com/carnet/verificar?socio=128&token=abcdefghijklmnopqrstuvwxyz012345&emitido=2026-08-26",
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.ok((largo.moduleSizeMm ?? 0) < (corto.moduleSizeMm ?? 0));
});

test("un contenido que no entra en ningun QR es invalido", () => {
  const r = evaluateQrLegibility({
    payload: "x".repeat(5000),
    errorCorrection: "H",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "INVALID");
});

test("un contenido vacio es invalido", () => {
  const r = evaluateQrLegibility({
    payload: "",
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "INVALID");
});

test("en pantalla la medida es en pixeles, no en milimetros", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: 200,
    medium: "SCREEN",
    dpi: 96,
  });
  assert.equal(r.moduleSizeMm, undefined);
  assert.ok(r.moduleSizePx && r.moduleSizePx > 2);
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readDesignDocument } from "../document/migrate";
import { validateForPublish } from "./publish";
import type { VariableContract } from "../variables/contract";
import type { TextMeasurer } from "../layout/plan";

const medidor: TextMeasurer = {
  widthOf: (texto, _f, _s, sizePt) => texto.length * sizePt * 0.5,
};

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

const contratoCarnet: VariableContract = {
  variables: [
    { key: "fullName", type: "text", label: "Nombre completo", required: true, sampleValue: "Daniel Cuart", maxLength: 34 },
    { key: "memberNumber", type: "number", label: "Número de socio", required: true, sampleValue: "128", decimals: 0 },
    { key: "category", type: "text", label: "Categoría", required: false, sampleValue: "Activo" },
    { key: "validUntil", type: "date", label: "Vigente hasta", required: true, sampleValue: "2028-08-26", dateFormat: "es-AR-short" },
    { key: "verificationUrl", type: "qrPayload", label: "Enlace de verificación", required: true, sampleValue: "https://fotoffice.com/c/AB12CD34" },
    { key: "photo", type: "image", label: "Foto del socio", required: true, sampleValue: "socios/ejemplo/foto.jpg" },
  ],
};

test("el carnet de ejemplo se puede publicar", () => {
  const r = validateForPublish(documentoCarnet(), contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, true, r.errors.join(" | "));
});

test("no genera avisos espurios sobre el area segura", () => {
  const r = validateForPublish(documentoCarnet(), contratoCarnet, { measurer: medidor });
  assert.deepEqual(r.warnings, []);
});

test("rechaza un marcador que el contrato no declara", () => {
  const doc = documentoCarnet();
  const bloque = doc.sides[0]?.blocks[1];
  if (bloque && bloque.type === "text") bloque.content = "{{inventado}}";
  const r = validateForPublish(doc, contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /inventado/);
});

test("rechaza un QR apuntado a una variable que no es de tipo qrPayload ni url", () => {
  const doc = documentoCarnet();
  const qr = doc.sides[1]?.blocks[0];
  if (qr && qr.type === "qrcode") qr.variableKey = "fullName";
  const r = validateForPublish(doc, contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /fullName/);
});

test("rechaza una imagen apuntada a una variable que no es de tipo image", () => {
  const doc = documentoCarnet();
  const foto = doc.sides[0]?.blocks[5];
  if (foto && foto.type === "image") foto.variableKey = "fullName";
  const r = validateForPublish(doc, contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, false);
});

test("rechaza si el valor de ejemplo mas largo permitido no entra en la caja", () => {
  const contratoLargo: VariableContract = {
    ...contratoCarnet,
    variables: contratoCarnet.variables.map((v) =>
      v.key === "fullName" ? { ...v, maxLength: 200, sampleValue: "Ma ".repeat(60).trim() } : v,
    ),
  };
  const r = validateForPublish(documentoCarnet(), contratoLargo, { measurer: medidor });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /no entra|desborda/i);
});

test("rechaza un QR demasiado chico para el contenido de ejemplo", () => {
  const doc = documentoCarnet();
  const qr = doc.sides[1]?.blocks[0];
  if (qr && qr.type === "qrcode") {
    qr.width = 8;
    qr.height = 8;
  }
  const r = validateForPublish(doc, contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /QR/);
});

test("avisa sin bloquear cuando un bloque invade el area segura", () => {
  const doc = documentoCarnet();
  const bloque = doc.sides[0]?.blocks[1];
  if (bloque) bloque.x = 0.5;
  const r = validateForPublish(doc, contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, true, r.errors.join(" | "));
  assert.ok(r.warnings.some((w) => /área segura|area segura/i.test(w)));
});

test("rechaza una variable requerida por el contrato que ningun bloque usa", () => {
  const contratoDeMas: VariableContract = {
    variables: [
      ...contratoCarnet.variables,
      { key: "huerfana", type: "text", label: "Huérfana", required: true, sampleValue: "x" },
    ],
  };
  const r = validateForPublish(documentoCarnet(), contratoDeMas, { measurer: medidor });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /huerfana/);
});
