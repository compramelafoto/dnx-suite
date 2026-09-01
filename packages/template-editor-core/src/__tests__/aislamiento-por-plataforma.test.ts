import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAllowedVariableKeysForProduct,
  resolveTemplateProduct,
  resolveTemplateVariablePlugin,
  type TemplateProductId,
} from "../resolve-template-product";
import {
  getInsertableImageVariablesForProduct,
  getVariableGroupsForProduct,
} from "../variable-catalog-product";

const PLATAFORMAS: TemplateProductId[] = ["fotoffice", "fotorank", "clickaton", "school"];

const clavesDe = (p: TemplateProductId) =>
  new Set(getVariableGroupsForProduct(p).flatMap((g) => g.variables.map((v) => v.key)));

test("cada plataforma ofrece variables, y son suyas", () => {
  for (const p of PLATAFORMAS) {
    assert.ok(clavesDe(p).size > 0, `${p} se quedó sin catálogo`);
  }
});

test("ninguna plataforma ve las variables propias de otra", () => {
  /*
   * El pedido de fondo. Antes el catálogo del editor y el registro del motor eran dos listas
   * distintas, y todo lo que no fuera Clickatón caía en el catálogo genérico de escuela: en
   * FotoOffice aparecían "Logo escuela" y "Alumno".
   *
   * Se comprueba contra las variables **propias** de cada producto, no contra toda coincidencia
   * de nombre. Que FotoOffice y FotoRank tengan los dos `verificationUrl` no es una fuga: los
   * dos verifican algo y cada plantilla se resuelve contra el registro de su producto, así que
   * en un carnet esa clave es la del socio y en un diploma la del diploma. Obligarlos a
   * llamarse distinto no protegería de nada y haría peor los dos nombres.
   */
  const PROPIAS: Record<string, string[]> = {
    fotoffice: ["memberNumber", "cardNumber", "institutionName", "photo"],
    fotorank: ["recipientName", "diplomaCode", "prizeLabel", "contestTitle"],
    clickaton: ["participant.photoUrl", "edition.name"],
    school: ["student.fullName", "branding.schoolLogoUrl"],
  };

  for (const [duenio, propias] of Object.entries(PROPIAS)) {
    for (const otra of PLATAFORMAS) {
      if (otra === duenio) continue;
      const intrusas = propias.filter((k) => clavesDe(otra).has(k));
      assert.deepEqual(
        intrusas,
        [],
        `${otra} ofrece variables de ${duenio}: ${intrusas.join(", ")}`,
      );
    }
    for (const k of propias) {
      assert.ok(clavesDe(duenio as TemplateProductId).has(k), `${duenio} perdió ${k}`);
    }
  }
});

test("lo que el editor ofrece es exactamente lo que la emisión acepta", () => {
  /*
   * La invariante que arregla la vista previa. Se podía poner la foto del socio en el diseño y
   * la emisión la rechazaba como variable desconocida, porque el editor leía una lista y el
   * motor otra.
   */
  for (const p of PLATAFORMAS) {
    const ofrecidas = [...clavesDe(p)].sort();
    const aceptadas = [...getAllowedVariableKeysForProduct(p)].sort();
    assert.deepEqual(ofrecidas, aceptadas, `${p}: el editor y la emisión no coinciden`);
  }
});

test("un producto desconocido no hereda el vocabulario de nadie", () => {
  assert.equal(getVariableGroupsForProduct("unknown").length, 0);
  assert.equal(getAllowedVariableKeysForProduct("unknown").size, 0);
  assert.equal(resolveTemplateVariablePlugin("unknown").listVariableDefinitions().length, 0);
});

test("las imágenes insertables también quedan de cada lado", () => {
  const foto = getInsertableImageVariablesForProduct("fotoffice").map((v) => v.key);
  assert.deepEqual(foto.sort(), ["institutionLogo", "photo"]);

  for (const p of PLATAFORMAS) {
    for (const v of getInsertableImageVariablesForProduct(p)) {
      assert.ok(
        getAllowedVariableKeysForProduct(p).has(v.key),
        `${p} ofrece insertar ${v.key} y la emisión no la conoce`,
      );
    }
  }
});

test("cada plataforma se reconoce por su metadata", () => {
  for (const p of PLATAFORMAS) {
    assert.equal(resolveTemplateProduct({ product: p }), p);
  }
  // Sin producto declarado se asume el más viejo, que es el que tenían las plantillas de antes.
  assert.equal(resolveTemplateProduct({}), "school");
  assert.equal(resolveTemplateProduct({ product: "inventado" }), "unknown");
});

test("FotoOffice ofrece lo que el carnet necesita", () => {
  const k = clavesDe("fotoffice");
  for (const necesaria of [
    "fullName", "memberNumber", "category", "validUntil",
    "photo", "verificationUrl", "institutionName", "cardNumber",
  ]) {
    assert.ok(k.has(necesaria), `falta ${necesaria}`);
  }
});

test("FotoRank ofrece lo que el diploma ya usa hoy", () => {
  const k = clavesDe("fotorank");
  for (const necesaria of [
    "recipientName", "contestTitle", "categoryName", "prizeLabel",
    "organizerName", "entryTitle", "diplomaCode", "issuedDate", "verificationUrl",
  ]) {
    assert.ok(k.has(necesaria), `falta ${necesaria}`);
  }
});
