import { test } from "node:test";
import assert from "node:assert/strict";
import { mmToPt, ptToMm, mmToPx, pxToPt } from "./units";

test("una pulgada son 25,4 mm y 72 puntos", () => {
  assert.equal(Math.round(mmToPt(25.4) * 1000) / 1000, 72);
});

test("mmToPt y ptToMm son inversas", () => {
  const original = 85.6;
  assert.ok(Math.abs(ptToMm(mmToPt(original)) - original) < 1e-9);
});

test("mmToPx respeta los puntos por pulgada", () => {
  assert.equal(Math.round(mmToPx(25.4, 300)), 300);
  assert.equal(Math.round(mmToPx(25.4, 96)), 96);
});

test("un pixel de pantalla vale 0,75 puntos", () => {
  assert.equal(pxToPt(96), 72);
});

import { parseDesignDocument } from "./parse";
import { DESIGN_SCHEMA_VERSION } from "./schema";

function carnetValido() {
  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    metadata: { name: "Carnet SFPR" },
    format: {
      medium: "PRINT",
      width: 85.6,
      height: 54,
      dpi: 300,
      bleedMm: 3,
      safeAreaMm: 3,
    },
    sides: [
      {
        id: "frente",
        name: "Frente",
        background: "#ffffff",
        blocks: [
          {
            id: "nombre",
            type: "text",
            x: 6,
            y: 20,
            width: 55,
            height: 8,
            fontId: "dmSans",
            fontSize: 11,
            color: "#111111",
            align: "left",
            content: "{{fullName}}",
          },
        ],
      },
      {
        id: "dorso",
        name: "Dorso",
        background: "#ffffff",
        blocks: [
          {
            id: "qr",
            type: "qrcode",
            x: 55,
            y: 14,
            width: 26,
            height: 26,
            variableKey: "verificationUrl",
            errorCorrection: "M",
            quietZoneModules: 4,
          },
        ],
      },
    ],
  };
}

test("acepta un carnet bien formado", () => {
  const r = parseDesignDocument(carnetValido());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.sides.length, 2);
  assert.equal(r.value.format.medium, "PRINT");
});

test("rechaza un documento que no es un objeto", () => {
  const r = parseDesignDocument("no soy un documento");
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /documento/i);
});

test("rechaza un bloque de tipo desconocido en vez de ignorarlo", () => {
  const doc = carnetValido();
  doc.sides[0]!.blocks.push({ id: "raro", type: "video", x: 0, y: 0, width: 1, height: 1 } as never);
  const r = parseDesignDocument(doc);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /video/);
});

test("rechaza un PRINT sin dpi porque no se podria rasterizar", () => {
  const doc = carnetValido();
  delete (doc.format as Record<string, unknown>).dpi;
  const r = parseDesignDocument(doc);
  assert.equal(r.ok, false);
});

test("rechaza identificadores de cara repetidos", () => {
  const doc = carnetValido();
  doc.sides[1]!.id = "frente";
  const r = parseDesignDocument(doc);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /frente/);
});

test("rechaza un documento sin caras", () => {
  const doc = carnetValido();
  doc.sides = [];
  const r = parseDesignDocument(doc);
  assert.equal(r.ok, false);
});

test("acumula todos los errores, no solo el primero", () => {
  const r = parseDesignDocument({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    metadata: {},
    format: {},
    sides: [],
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.errors.length >= 2, `esperaba varios errores, hubo ${r.errors.length}`);
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrateDesignDocument, readDesignDocument, type DocumentMigration } from "./migrate";

const fixtureV1 = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/carnet-v1.json", import.meta.url)), "utf8"),
) as unknown;

test("el documento historico congelado sigue leyendose", () => {
  const r = readDesignDocument(fixtureV1);
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.value.sides.length, 2);
  assert.equal(r.value.sides[0]?.blocks.length, 6);
  assert.equal(r.value.sides[1]?.blocks.length, 4);
});

test("encadena migraciones sucesivas hasta la version actual", () => {
  const migraciones: Record<number, DocumentMigration> = {
    // 0 → 1: la cara única pasa a ser un arreglo de caras
    0: (doc) => ({
      schemaVersion: 1,
      metadata: doc.metadata,
      format: doc.format,
      sides: [{ id: "unica", name: "Única", background: "#ffffff", blocks: doc.blocks }],
    }),
  };
  const viejo = {
    schemaVersion: 0,
    metadata: { name: "Viejo" },
    format: { medium: "SCREEN", width: 1080, height: 1080 },
    blocks: [
      {
        id: "t",
        type: "text",
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        fontId: "dmSans",
        fontSize: 24,
        color: "#000000",
        content: "Hola",
      },
    ],
  };
  const r = readDesignDocument(viejo, migraciones);
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.value.schemaVersion, 1);
  assert.equal(r.value.sides.length, 1);
});

test("rechaza un documento de una version futura sin intentar interpretarlo", () => {
  const futuro = { schemaVersion: 99, metadata: { name: "Futuro" }, format: {}, sides: [] };
  const r = readDesignDocument(futuro);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /más nueva|mas nueva|99/);
});

test("rechaza una version vieja para la que no hay migracion escrita", () => {
  const huerfano = { schemaVersion: 0, metadata: { name: "Huérfano" }, format: {}, sides: [] };
  const r = migrateDesignDocument(huerfano, {});
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /0/);
});
