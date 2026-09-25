import assert from "node:assert/strict";
import test from "node:test";

import { claveDeLocalidad } from "./clave";

test("las variantes reales de Rosario caen en la misma clave", () => {
  const variantes: [string, string][] = [
    ["Rosario", "Santa Fe"],
    ["ROSARIO", "SANTA FE"],
    ["rosario", "santa Fe"],
    ["Rosario", "Snta Fe"],
    ["ROSARIO (SANTA FE - CP. 2000)", "Santa Fe"],
    [" Rosario ", "Santa fe"],
  ];
  for (const [ciudad, provincia] of variantes) {
    assert.equal(claveDeLocalidad(ciudad, provincia), "rosario|santa fe", `${ciudad} / ${provincia}`);
  }
});

test("las tildes no separan ciudades", () => {
  assert.equal(claveDeLocalidad("San Jerónimo Sud", "Santa Fe"), "san jeronimo sud|santa fe");
  assert.equal(claveDeLocalidad("Cañada de Gomez", "Santa Fe"), "canada de gomez|santa fe");
});

test("sin ciudad no hay clave", () => {
  assert.equal(claveDeLocalidad(null, "Santa Fe"), null);
  assert.equal(claveDeLocalidad("  ", null), null);
});

test("una provincia ilegible queda como está, para revisarla", () => {
  assert.equal(claveDeLocalidad("ROsario", "S"), "rosario|s");
});
