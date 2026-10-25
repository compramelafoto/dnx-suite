import { describe, expect, it } from "vitest";
import { esUrlWeb } from "./url";

describe("esUrlWeb", () => {
  it("acepta http y https", () => {
    expect(esUrlWeb("https://ejemplo.com/a")).toBe(true);
    expect(esUrlWeb("http://ejemplo.com")).toBe(true);
  });
  it("rechaza otros esquemas, vacío y null", () => {
    expect(esUrlWeb("javascript:alert(1)")).toBe(false);
    expect(esUrlWeb("data:text/html,x")).toBe(false);
    expect(esUrlWeb("//ejemplo.com")).toBe(false);
    expect(esUrlWeb("")).toBe(false);
    expect(esUrlWeb(null)).toBe(false);
  });
});
