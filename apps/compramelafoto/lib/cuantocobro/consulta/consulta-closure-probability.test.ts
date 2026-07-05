import { describe, expect, it } from "vitest";
import {
  formatConsultaClosureProbability,
  parseClosureProbabilitySelectValue,
  resolveClosestClosureProbabilityValue,
  resolveClosureProbabilitySelectValue,
} from "./consulta-closure-probability";

describe("consulta-closure-probability", () => {
  it("mapea select vacío a null", () => {
    expect(parseClosureProbabilitySelectValue("")).toBeNull();
    expect(resolveClosureProbabilitySelectValue(null)).toBe("");
  });

  it("resuelve valores conocidos del select", () => {
    expect(parseClosureProbabilitySelectValue("75")).toBe(75);
    expect(resolveClosureProbabilitySelectValue(75)).toBe("75");
    expect(formatConsultaClosureProbability(75)).toBe("Alta");
  });

  it("aproxima valores históricos al bucket más cercano", () => {
    expect(resolveClosestClosureProbabilityValue(45)).toBe(50);
    expect(resolveClosureProbabilitySelectValue(45)).toBe("50");
    expect(formatConsultaClosureProbability(45)).toBe("Media (≈45%)");
  });
});
