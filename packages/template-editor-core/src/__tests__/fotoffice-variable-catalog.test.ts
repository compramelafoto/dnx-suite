import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAllowedVariableKeysForProduct,
  isVariableUsableInForProduct,
  resolveTemplateProduct,
  createExampleDataForProduct,
} from "../resolve-template-product";
import { getVariableGroupsForProduct } from "../variable-catalog-product";
import { FOTOFFICE_VARIABLE_GROUPS } from "../variable-catalog-fotoffice";

/**
 * Las claves que el renderizador del carnet entrega hoy
 * (apps/fotoffice/lib/carnet/render.ts). Si el catálogo no las ofreciera, se podría diseñar
 * una plantilla que después no se puede completar.
 */
const CONTRATO_CARNET = [
  "institutionName",
  "fullName",
  "memberNumber",
  "cardNumber",
  "category",
  "validUntil",
  "photo",
  "verificationUrl",
];

test("metadata product: fotoffice se reconoce como producto propio", () => {
  assert.equal(resolveTemplateProduct({ product: "fotoffice" }), "fotoffice");
});

test("el catálogo cubre todo el contrato del carnet", () => {
  const claves = new Set(
    FOTOFFICE_VARIABLE_GROUPS.flatMap((g) => g.variables.map((v) => v.key))
  );
  for (const clave of CONTRATO_CARNET) {
    assert.ok(claves.has(clave), `falta la variable "${clave}" en el catálogo`);
  }
});

test("toda variable ofrecida es aceptada al guardar", () => {
  const permitidas = getAllowedVariableKeysForProduct("fotoffice");
  for (const grupo of getVariableGroupsForProduct("fotoffice")) {
    for (const v of grupo.variables) {
      assert.ok(
        permitidas.has(v.key),
        `"${v.key}" se ofrece en el editor pero el guardado la rechazaría`
      );
    }
  }
});

test("la foto va a bloques de imagen y no a bloques de texto", () => {
  assert.equal(isVariableUsableInForProduct("fotoffice", "photo", "IMAGE"), true);
  assert.equal(isVariableUsableInForProduct("fotoffice", "photo", "TEXT"), false);
});

test("una clave inventada no pasa la validación", () => {
  assert.equal(
    isVariableUsableInForProduct("fotoffice", "noExiste", "TEXT"),
    false
  );
  assert.equal(getAllowedVariableKeysForProduct("fotoffice").has("noExiste"), false);
});

test("la vista previa trae un valor para cada variable obligatoria", () => {
  const ejemplo = createExampleDataForProduct("fotoffice");
  for (const grupo of FOTOFFICE_VARIABLE_GROUPS) {
    for (const v of grupo.variables) {
      if (!v.requiredInV1) continue;
      if (v.valueType === "imageUrl") continue; // la foto se resuelve aparte
      assert.ok(
        typeof ejemplo[v.key] === "string" && (ejemplo[v.key] as string).length > 0,
        `sin dato de ejemplo para "${v.key}"`
      );
    }
  }
});
