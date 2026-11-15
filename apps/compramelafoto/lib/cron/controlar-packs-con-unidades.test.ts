import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { beneficiosQueNoAlcanzan } from "./controlar-packs-con-unidades";

const carpeta = (cantidad: number) => ({
  benefits: [{ stableKey: "88:benefit:102", includedQuantity: cantidad, name: `${cantidad}× Carpeta escolar · 2 fotos` }],
});

describe("beneficiosQueNoAlcanzan", () => {
  it("un pack solo nunca tiene problemas", () => {
    assert.deepEqual(beneficiosQueNoAlcanzan(carpeta(1), 1), []);
  });

  it("2 packs con 2 carpetas está bien", () => {
    assert.deepEqual(beneficiosQueNoAlcanzan(carpeta(2), 2), []);
  });

  it("2 packs con 1 carpeta es el caso del pedido 4789", () => {
    assert.deepEqual(beneficiosQueNoAlcanzan(carpeta(1), 2), [
      "1× Carpeta escolar · 2 fotos (incluye 1 para 2 packs)",
    ]);
  });

  it("2 packs con 3 copias no se reparte parejo", () => {
    assert.equal(beneficiosQueNoAlcanzan(carpeta(3), 2).length, 1);
  });

  it("los beneficios en cero y los snapshots raros no avisan", () => {
    assert.deepEqual(beneficiosQueNoAlcanzan(carpeta(0), 2), []);
    assert.deepEqual(beneficiosQueNoAlcanzan(null, 2), []);
    assert.deepEqual(beneficiosQueNoAlcanzan({ benefits: "x" }, 2), []);
  });
});
