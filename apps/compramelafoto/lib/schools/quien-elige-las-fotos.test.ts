import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DIAS_POR_DEFECTO,
  MODOS_ELECCION,
  TEXTOS_MODO,
  familiaPuedeElegir,
  leerRegla,
  quienElige,
  type ReglaEleccion,
} from "./quien-elige-las-fotos";

const FAMILIA: ReglaEleccion = { mode: "FAMILY", familyDays: 7 };
const FOTOGRAFO: ReglaEleccion = { mode: "PHOTOGRAPHER", familyDays: 7 };
const CON_PLAZO: ReglaEleccion = { mode: "FAMILY_THEN_PHOTOGRAPHER", familyDays: 7 };

// Hora argentina (UTC-3).
const ar = (iso: string) => new Date(`${iso}-03:00`);

describe("leerRegla", () => {
  it("sin fila: la familia, con los días por defecto", () => {
    assert.deepEqual(leerRegla(null), { mode: "FAMILY", familyDays: DIAS_POR_DEFECTO });
    assert.equal(DIAS_POR_DEFECTO, 7);
  });

  it("un modo desconocido vuelve a la familia", () => {
    assert.equal(leerRegla({ mode: "CUALQUIERA", familyDays: 3 }).mode, "FAMILY");
  });

  it("respeta los tres modos válidos", () => {
    for (const mode of MODOS_ELECCION) assert.equal(leerRegla({ mode, familyDays: 3 }).mode, mode);
  });

  it("acota los días entre 1 y 60", () => {
    assert.equal(leerRegla({ mode: "FAMILY_THEN_PHOTOGRAPHER", familyDays: 0 }).familyDays, 1);
    assert.equal(leerRegla({ mode: "FAMILY_THEN_PHOTOGRAPHER", familyDays: 90 }).familyDays, 60);
    assert.equal(leerRegla({ mode: "FAMILY_THEN_PHOTOGRAPHER", familyDays: null }).familyDays, 7);
    assert.equal(leerRegla({ mode: "FAMILY_THEN_PHOTOGRAPHER", familyDays: 3.6 }).familyDays, 4);
  });
});

describe("quienElige", () => {
  const inicio = ar("2026-11-01T00:00:00");

  it("FAMILY: siempre la familia", () => {
    assert.equal(quienElige(FAMILIA, { inicio }, ar("2027-01-01T00:00:00")), "FAMILIA");
  });

  it("PHOTOGRAPHER: siempre el fotógrafo", () => {
    assert.equal(quienElige(FOTOGRAFO, { inicio }, inicio), "FOTOGRAFO");
  });

  it("con plazo: la familia hasta que se cumplen los días", () => {
    assert.equal(quienElige(CON_PLAZO, { inicio }, ar("2026-11-07T23:59:00")), "FAMILIA");
  });

  it("con plazo: el fotógrafo una vez vencido", () => {
    assert.equal(quienElige(CON_PLAZO, { inicio }, ar("2026-11-08T00:01:00")), "FOTOGRAFO");
  });

  it("cambiar la regla sólo mueve lo que todavía no se canjeó (la cuenta depende sólo de la regla)", () => {
    const ahora = ar("2026-11-02T00:00:00");
    assert.equal(quienElige(FAMILIA, { inicio }, ahora), "FAMILIA");
    assert.equal(quienElige(FOTOGRAFO, { inicio }, ahora), "FOTOGRAFO");
  });
});

describe("familiaPuedeElegir", () => {
  it("la familia puede salvo cuando elige el fotógrafo", () => {
    assert.equal(familiaPuedeElegir(FAMILIA), true);
    assert.equal(familiaPuedeElegir(FOTOGRAFO), false);
    assert.equal(familiaPuedeElegir(CON_PLAZO), true);
  });
});

describe("TEXTOS_MODO", () => {
  it("tiene título y ayuda para cada modo", () => {
    assert.equal(TEXTOS_MODO.FAMILY.titulo, "La familia");
    assert.equal(TEXTOS_MODO.PHOTOGRAPHER.titulo, "Yo (el fotógrafo)");
    assert.equal(TEXTOS_MODO.FAMILY_THEN_PHOTOGRAPHER.titulo, "La familia, y si no elige, yo");
  });
});
