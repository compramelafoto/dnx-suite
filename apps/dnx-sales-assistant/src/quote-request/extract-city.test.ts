import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCity } from "./extract-city.js";

describe("extractCity", () => {
  it("normaliza ciudades conocidas", () => {
    assert.equal(extractCity("en Córdoba"), "Córdoba");
    assert.equal(extractCity("Córdoba Capital"), "Córdoba Capital");
    assert.equal(extractCity("Buenos Aires"), "Buenos Aires");
    assert.equal(extractCity("en bs as"), "Buenos Aires");
    assert.equal(extractCity("Villa Carlos Paz"), "Villa Carlos Paz");
  });

  it("ciudad no reconocida queda ausente", () => {
    assert.equal(extractCity("en Ciudad Inventada"), undefined);
  });
});
