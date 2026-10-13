import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { chosenProductNameFromMetadata, resolveExportProductName } from "./export-product-name";

// Productos reales de Vanesa Carreras (todos 15x21 mate).
const VANESA = [
  { name: "Foto grupal", size: "15x21 cm", acabado: "mate" },
  { name: "Foto individual con la seño", size: "15x21 cm", acabado: "mate" },
  { name: "Foto impresa", size: "15x21 cm", acabado: "mate" },
];

describe("resolveExportProductName", () => {
  it("con varios productos del mismo tamaño elige el genérico, no el primero", () => {
    assert.equal(resolveExportProductName(VANESA, "15x21 cm", "MATE"), "Foto impresa");
  });

  it("el producto que eligió el cliente manda", () => {
    assert.equal(resolveExportProductName(VANESA, "15x21 cm", "MATE", "Foto grupal"), "Foto grupal");
  });

  it("compara el acabado sin importar mayúsculas", () => {
    const rows = [
      { name: "Brillante 10x15", size: "10x15", acabado: "brillo" },
      { name: "Mate 10x15", size: "10x15", acabado: "mate" },
    ];
    assert.equal(resolveExportProductName(rows, "10x15", "MATE"), "Mate 10x15");
  });

  it("un solo producto de ese tamaño se usa aunque el acabado no coincida", () => {
    const rows = [{ name: "Carpeta escolar", size: "20x30 cm", acabado: "mate" }];
    assert.equal(resolveExportProductName(rows, "20x30 cm", "BRILLO"), "Carpeta escolar");
  });

  it("varios sin genérico: carpeta neutra en vez de una equivocada", () => {
    const rows = VANESA.filter((p) => p.name !== "Foto impresa");
    assert.equal(resolveExportProductName(rows, "15x21 cm", "MATE"), "Foto Impresa");
  });

  it("sin productos de ese tamaño: Foto Impresa", () => {
    assert.equal(resolveExportProductName(VANESA, "10x15", "MATE"), "Foto Impresa");
  });
});

describe("chosenProductNameFromMetadata", () => {
  it("lee el nombre guardado y descarta lo que no sirve", () => {
    assert.equal(chosenProductNameFromMetadata({ productName: " Foto grupal " }), "Foto grupal");
    assert.equal(chosenProductNameFromMetadata({ productName: "" }), null);
    assert.equal(chosenProductNameFromMetadata(null), null);
    assert.equal(chosenProductNameFromMetadata("x"), null);
  });
});
