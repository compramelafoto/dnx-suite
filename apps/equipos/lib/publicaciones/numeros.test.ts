import { describe, expect, it } from "vitest";
import { parseEnteroPesos } from "./numeros";

describe("parseEnteroPesos", () => {
  it("vacío o ausente → null", () => {
    expect(parseEnteroPesos("")).toBeNull();
    expect(parseEnteroPesos("   ")).toBeNull();
    expect(parseEnteroPesos(null)).toBeNull();
  });
  it("enteros y miles con punto", () => {
    expect(parseEnteroPesos("1850000")).toBe(1850000);
    expect(parseEnteroPesos("1.850.000")).toBe(1850000);
    expect(parseEnteroPesos(" 1500 ")).toBe(1500);
  });
  it("decimales, comas y letras → NaN", () => {
    expect(parseEnteroPesos("1500.50")).toBeNaN();
    expect(parseEnteroPesos("1.5")).toBeNaN();
    expect(parseEnteroPesos("1,5")).toBeNaN();
    expect(parseEnteroPesos("abc")).toBeNaN();
  });
});
