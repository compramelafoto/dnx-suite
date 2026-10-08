import { test } from "node:test";
import assert from "node:assert/strict";
import { emitDesign } from "@repo/design-studio";
import {
  buildContractForProduct,
  documentoAEditor,
  editorADocumento,
} from "@repo/template-editor-core/rendering";
import { getAllowedVariableKeysForProduct, createFotorankExampleData } from "@repo/template-editor-core";
import { designAssetKeyFromRef, designAssetKeyFromSegments, designAssetUrl, designAssetKey } from "./asset-storage";
import { readDiplomaDesignLink, parseWinnerFormat } from "./constants";
import { diplomaDesignDocument, winnerDesignDocument } from "./documents";
import { pruneEmptyBlocks } from "./prune";
import { safeReturnPath } from "./return-path";

test("la ruta pública de una imagen del diseño vuelve a su clave, y nada más", () => {
  const key = designAssetKey({ templateId: "tpl1", versionId: "v1", fileName: "block_abc-1.png" });
  const url = designAssetUrl(key);
  assert.equal(url, "/api/fotorank/design-assets/tpl1/v1/block_abc-1.png");
  assert.equal(designAssetKeyFromRef(url), key);
  assert.equal(designAssetKeyFromRef(`https://fotorank.com${url}`), key);
  assert.equal(designAssetKeyFromSegments(["..", "v1", "a.png"]), null);
  assert.equal(designAssetKeyFromSegments(["tpl1", "v1", "a.exe"]), null);
  assert.equal(designAssetKeyFromSegments(["tpl1", "v1"]), null);
  assert.equal(designAssetKeyFromRef("https://otro.com/x.png"), null);
});

test("el vínculo de un diploma con su diseño se lee sólo si es del diseñador", () => {
  assert.deepEqual(readDiplomaDesignLink({ engine: "designer", designTemplateId: "t1" }), {
    engine: "designer",
    designTemplateId: "t1",
  });
  assert.equal(readDiplomaDesignLink({ version: 1, blocks: [] }), null);
  assert.equal(readDiplomaDesignLink(null), null);
  assert.equal(parseWinnerFormat("historia"), "historia");
  assert.equal(parseWinnerFormat("otro"), null);
});

test("la vuelta del diseñador sólo acepta rutas internas del panel", () => {
  assert.equal(safeReturnPath("/dashboard/concursos/x/diplomas"), "/dashboard/concursos/x/diplomas");
  assert.equal(safeReturnPath("https://malo.com"), null);
  assert.equal(safeReturnPath("//malo.com/dashboard/"), null);
  assert.equal(safeReturnPath("/login"), null);
});

test("la poda saca imágenes y textos sin datos, y deja los que tienen al menos uno", () => {
  const doc = {
    sides: [
      {
        blocks: [
          { id: "logo", type: "image", variableKey: "organizerLogo" },
          { id: "fondo", type: "image", resourceRef: "/x.png" },
          { id: "qr", type: "qrcode", variableKey: "verificationUrl" },
          { id: "obra", type: "text", content: "por la obra «{{entryTitle}}»" },
          { id: "mixto", type: "text", content: "{{prizeLabel}} · {{categoryName}}" },
          { id: "fijo", type: "text", content: "Diploma" },
        ],
      },
    ],
  };
  const { removed } = pruneEmptyBlocks(doc, {
    organizerLogo: null,
    verificationUrl: "",
    entryTitle: null,
    prizeLabel: "1.er premio",
    categoryName: null,
  });
  assert.deepEqual(removed.sort(), ["logo", "obra", "qr"]);
});

/** Ida y vuelta por el modelo del editor y emisión real, con imágenes de 1 px. */
async function emitir(documento: unknown, valores: Record<string, unknown>) {
  const semilla = documentoAEditor(documento);
  const puente = editorADocumento({
    canvas: semilla.canvas as never,
    blocks: semilla.blocks.map((b, i) => ({ ...b, id: `b${i}` })) as never,
    variablesConocidas: getAllowedVariableKeysForProduct("fotorank"),
  });
  assert.deepEqual(puente.avisos, []);
  const pixel = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  const { document } = pruneEmptyBlocks(puente.document, valores);
  return emitDesign({
    document,
    contract: buildContractForProduct("fotorank"),
    values: valores as never,
    formats: ["PDF", "PNG_PER_SIDE"],
    pngDpi: 36,
    includeBleed: false,
    resources: { read: async () => pixel },
    fileBaseName: "prueba",
  });
}

test("los tres diseños base se emiten con datos de muestra", async () => {
  const muestra = createFotorankExampleData();
  for (const doc of [diplomaDesignDocument(), winnerDesignDocument("cuadrada"), winnerDesignDocument("historia")]) {
    const r = await emitir(doc, { ...muestra });
    assert.ok(r.ok, r.ok ? "" : r.errors.join(" "));
  }
});

test("un diploma de jurado (sin obra, premio ni logo) sale igual", async () => {
  const r = await emitir(diplomaDesignDocument(), {
    recipientName: "Ana Pérez",
    contestTitle: "Santa Fe en Foco",
    organizerName: "SFPR",
    issuedDate: "2026-10-08",
    diplomaCode: "FR-X-1",
    verificationUrl: "https://fotorank.com/diplomas/verificar/abc",
  });
  assert.ok(r.ok, r.ok ? "" : r.errors.join(" "));
});
