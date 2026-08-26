import { describe, expect, it } from "vitest";
import {
  MIN_TEXT_SEARCH_LENGTH,
  normalizeSearchText,
  ocrTokenWhereForQuery,
} from "./text-query";

describe("text-query search helpers", () => {
  it("permite consultas de 1 carácter", () => {
    expect(MIN_TEXT_SEARCH_LENGTH).toBe(1);
    expect(normalizeSearchText("5").length).toBeGreaterThanOrEqual(MIN_TEXT_SEARCH_LENGTH);
  });

  it("normaliza espacios y guiones", () => {
    expect(normalizeSearchText(" ab-12 ")).toBe("AB12");
  });

  it("usa igualdad exacta para números", () => {
    expect(ocrTokenWhereForQuery("5")).toEqual({ textNorm: "5" });
    expect(ocrTokenWhereForQuery("33")).toEqual({ textNorm: "33" });
  });

  it("usa contains para texto", () => {
    expect(ocrTokenWhereForQuery("JUAN")).toEqual({ textNorm: { contains: "JUAN" } });
  });
});
