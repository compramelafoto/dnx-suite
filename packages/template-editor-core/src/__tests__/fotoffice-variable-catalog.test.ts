import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAllowedVariableKeysForProduct,
  isVariableUsableInForProduct,
  resolveTemplateProduct,
  createExampleDataForProduct,
} from "../resolve-template-product";
import {
  getInsertableImageVariablesForProduct,
  getQrVariablesForProduct,
  getVariableGroupsForProduct,
} from "../variable-catalog-product";
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

test("FotoOffice puede insertar la foto del socio y el logo de la institución", () => {
  const claves = getInsertableImageVariablesForProduct("fotoffice").map((v) => v.key);
  // La regresión concreta: el editor ofrecía "Logo escuela" y ninguna forma de poner la foto.
  assert.deepEqual(claves.sort(), ["institutionLogo", "photo"]);
});

test("cada producto ofrece sus imágenes, no las de otro", () => {
  const foto = getInsertableImageVariablesForProduct("fotoffice").map((v) => v.key);
  const escuela = getInsertableImageVariablesForProduct("school").map((v) => v.key);
  assert.ok(!foto.some((k) => escuela.includes(k)), "FotoOffice no debe ofrecer imágenes de escuela");
  assert.ok(escuela.some((k) => k.includes("schoolLogo")), "la escuela conserva su logo");
});

test("las imágenes insertables salen del catálogo, no de una lista aparte", () => {
  for (const v of getInsertableImageVariablesForProduct("fotoffice")) {
    assert.equal(v.valueType, "imageUrl");
    assert.ok(v.usableIn.includes("IMAGE"));
    assert.ok(v.label.length > 0, `${v.key} sin nombre visible`);
  }
});

test("una plantilla de FotoOffice se reconoce como tal y no cae en escuela", () => {
  /*
   * El shell resolvía el producto con `=== "clickaton" ? "clickaton" : "school"`. Una plantilla
   * de FotoOffice caía en la rama de escuela y el editor le ofrecía las variables de un
   * colegio: todo el catálogo de socios existía y no había forma de llegar a él.
   */
  const meta = { templateKey: "carnet-socio-v1", product: "fotoffice", origin: "system" };
  const producto = resolveTemplateProduct(meta);
  assert.equal(producto, "fotoffice");
  assert.notEqual(producto, "school");

  const claves = getVariableGroupsForProduct(producto)
    .flatMap((g) => g.variables)
    .map((v) => v.key);
  assert.ok(claves.includes("photo"), "tiene que ofrecer la foto del socio");
  assert.ok(claves.includes("memberNumber"), "y el número de socio");
});

test("el QR de cada plataforma sale de su catálogo", () => {
  /*
   * El bloque de QR nacía con la variable vacía: quien lo insertaba veía un cuadrado en blanco
   * y concluía, con razón, que faltaba el QR del socio.
   */
  const foto = getQrVariablesForProduct("fotoffice");
  assert.equal(foto.length, 1);
  assert.equal(foto[0]!.key, "verificationUrl");
  assert.equal(foto[0]!.valueType, "qrUrl");

  // Cada producto verifica lo suyo: el socio en uno, el diploma en el otro.
  assert.equal(getQrVariablesForProduct("fotorank")[0]?.key, "verificationUrl");
  assert.equal(getQrVariablesForProduct("school")[0]?.key, "order.fulfillmentQrUrl");
});

test("el QR que se ofrece es uno que la emisión sabe resolver", () => {
  for (const p of ["fotoffice", "fotorank", "school"] as const) {
    for (const v of getQrVariablesForProduct(p)) {
      assert.ok(
        getAllowedVariableKeysForProduct(p).has(v.key),
        `${p} ofrece el QR ${v.key} y la emisión no lo conoce`,
      );
    }
  }
});

test("el QR del socio se puede guardar: es una dirección de QR válida", async () => {
  /*
   * Dos defectos encadenados hacían que insertar el QR y guardar fallara. El primero, un camino
   * de vínculo equivocado. El segundo, más de fondo: la validación medía al QR con la vara de
   * texto/imagen, y la variable que verifica al socio no está marcada como usable en imágenes,
   * así que rechazaba justo la correcta.
   */
  const { parseTemplateV2EditorPayload } = await import("../validate-save-payload");
  const r = parseTemplateV2EditorPayload({
    canvas: { width: 1011, height: 638 },
    meta: { product: "fotoffice" },
    blocks: [
      {
        id: "qr1",
        type: "QR",
        pageIndex: 0,
        layout: { x: 0, y: 0, width: 240, height: 240, rotation: 0, zIndex: 1, opacity: 1, visible: true, locked: false },
        configJson: { mode: "VARIABLE", variableKey: "verificationUrl" },
      },
    ],
    variableBindings: [
      { blockId: "qr1", variableKey: "verificationUrl", targetPath: "variableKey" },
    ],
  });
  assert.equal(r.ok, true, r.ok ? "" : r.error);
});

test("un QR atado a algo que no es una dirección de QR se rechaza", async () => {
  const { parseTemplateV2EditorPayload } = await import("../validate-save-payload");
  const r = parseTemplateV2EditorPayload({
    canvas: { width: 1011, height: 638 },
    meta: { product: "fotoffice" },
    blocks: [
      {
        id: "qr1",
        type: "QR",
        pageIndex: 0,
        layout: { x: 0, y: 0, width: 240, height: 240, rotation: 0, zIndex: 1, opacity: 1, visible: true, locked: false },
        configJson: { mode: "VARIABLE", variableKey: "fullName" },
      },
    ],
    variableBindings: [{ blockId: "qr1", variableKey: "fullName", targetPath: "variableKey" }],
  });
  assert.equal(r.ok, false);
});

test("el lienzo tiene un valor de muestra para el QR del socio", async () => {
  // Sin esto el bloque dice "Sin valor todavía" aunque la variable esté bien elegida.
  const { editorResolvedVariablesForProduct } = await import("../editor-mock-variables");
  const v = editorResolvedVariablesForProduct("fotoffice");
  assert.ok(typeof v.verificationUrl === "string" && (v.verificationUrl as string).length > 0);
  assert.ok(typeof v.fullName === "string");
});
