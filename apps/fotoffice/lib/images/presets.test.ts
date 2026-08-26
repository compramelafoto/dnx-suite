import { describe, expect, it } from "vitest";
import {
  IMAGE_PRESETS,
  formatImagePresetRecommendation,
  getImagePreset,
  isImagePresetKey,
} from "./presets";

describe("IMAGE_PRESETS — fuente única de verdad de recomendaciones de imagen", () => {
  it("cada preset declara todos los campos requeridos, sin números mágicos sueltos en el consumidor", () => {
    for (const preset of Object.values(IMAGE_PRESETS)) {
      expect(preset.widthRecommended).toBeGreaterThan(0);
      expect(preset.heightRecommended).toBeGreaterThan(0);
      expect(preset.minWidth).toBeGreaterThan(0);
      expect(preset.minHeight).toBeGreaterThan(0);
      expect(preset.maxFileSizeBytes).toBeGreaterThan(0);
      expect(preset.acceptedFormats.length).toBeGreaterThan(0);
      expect(["cover", "contain"]).toContain(preset.objectFit);
    }
  });

  it("getImagePreset devuelve undefined para keys inexistentes (no crashea, no inventa un preset)", () => {
    expect(getImagePreset("no-existe")).toBeUndefined();
    expect(getImagePreset("workspaceLogo")?.key).toBe("workspaceLogo");
  });

  it("isImagePresetKey es la whitelist real usada por la API route", () => {
    expect(isImagePresetKey("workspaceLogo")).toBe(true);
    expect(isImagePresetKey("cualquier-cosa")).toBe(false);
  });

  it("formatImagePresetRecommendation muestra resolución, relación, formatos y peso — nunca oculto en tooltip", () => {
    const text = formatImagePresetRecommendation(IMAGE_PRESETS.workspaceLogo);
    expect(text).toContain("1200");
    expect(text).toContain("1:1");
    expect(text).toContain("PNG");
    expect(text).toContain("MB");
  });

  it("workspaceLogo y workspaceCover (los dos presets de esta etapa) tienen namespace propio, no genérico", () => {
    expect(IMAGE_PRESETS.workspaceLogo.key).toBe("workspaceLogo");
    expect(IMAGE_PRESETS.workspaceCover.key).toBe("workspaceCover");
  });
});
