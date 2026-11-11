import { describe, expect, it } from "vitest";
import { tamanoLegible } from "./material";

describe("tamanoLegible", () => {
  it("no muestra nada si no se sabe el tamaño", () => {
    expect(tamanoLegible(null)).toBe("");
    expect(tamanoLegible(0)).toBe("");
  });
  it("muestra KB por debajo del mega", () => {
    expect(tamanoLegible(360_000)).toBe(" · 352 KB");
  });
  it("muestra MB con un decimal", () => {
    expect(tamanoLegible(7_552_882)).toBe(" · 7,2 MB");
  });
});
