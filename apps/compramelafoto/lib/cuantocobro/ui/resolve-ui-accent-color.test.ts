import { describe, expect, it } from "vitest";
import { CC_GREEN_PRIMARY } from "../theme";
import {
  CC_UI_ACCENT_FALLBACK,
  resolveUiAccentHex,
  sanitizeAccentHexForUi,
} from "./resolve-ui-accent-color";

describe("resolveUiAccentHex", () => {
  it("siempre devuelve el verde institucional de ¿Cuánto Cobro?", () => {
    expect(resolveUiAccentHex()).toBe(CC_GREEN_PRIMARY);
    expect(resolveUiAccentHex({ primaryColor: "#c27b3d" })).toBe(CC_GREEN_PRIMARY);
    expect(resolveUiAccentHex(null, { tradeName: "Solo nombre" })).toBe(CC_GREEN_PRIMARY);
    expect(CC_UI_ACCENT_FALLBACK).toBe(CC_GREEN_PRIMARY);
  });
});

describe("sanitizeAccentHexForUi", () => {
  it("oscurece colores demasiado claros", () => {
    const sanitized = sanitizeAccentHexForUi("#f5f5f5");
    expect(sanitized).not.toBe("#f5f5f5");
    expect(sanitized.startsWith("#")).toBe(true);
  });

  it("conserva colores con contraste suficiente", () => {
    expect(sanitizeAccentHexForUi("#16a34a")).toBe("#16a34a");
  });
});
