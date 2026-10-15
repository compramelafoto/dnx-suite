import { describe, expect, it } from "vitest";
import {
  IMAGE_PRESETS,
  formatImagePresetRecommendation,
  getImagePreset,
  isImagePresetKey,
  type ImagePreset,
} from "./presets";
import { FOTOFFICE_R2_PREFIXES } from "./r2-key-policy";

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

describe("preset memberPortfolioPhoto — la obra de un fotógrafo", () => {
  it("no fuerza proporción: hay panorámicas, verticales y cuadradas", () => {
    expect(IMAGE_PRESETS.memberPortfolioPhoto.aspectRatioFree).toBe(true);
  });

  it("admite hasta 10 MB: una foto de autor no entra en 3", () => {
    expect(IMAGE_PRESETS.memberPortfolioPhoto.maxFileSizeBytes).toBe(10 * 1024 * 1024);
  });

  it("acepta los tres formatos que el servidor sabe reconocer por firma binaria", () => {
    expect([...IMAGE_PRESETS.memberPortfolioPhoto.acceptedFormats].sort()).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });

  it("ningún otro preset queda con proporción libre por accidente", () => {
    // Leído a través del contrato, no del objeto literal: `aspectRatioFree` es opcional y los
    // presets que no lo declaran no tienen la propiedad en su tipo inferido.
    const todos: ImagePreset[] = Object.values(IMAGE_PRESETS);
    const libres = todos.filter((p) => p.aspectRatioFree);
    // `sizeChart` también, a propósito: una tabla de talles tiene la forma que tenga.
    expect(libres.map((p) => p.key).sort()).toEqual(["memberPortfolioPhoto", "sizeChart"]);
  });

  it("tiene su namespace propio en R2, separado del resto", () => {
    expect(FOTOFFICE_R2_PREFIXES.memberPortfolioPhoto).toBe("fotoffice/member-portfolio");
  });

  it("todo preset tiene su namespace: sin eso la subida falla recién al guardar", () => {
    const conNamespace = new Set(Object.keys(FOTOFFICE_R2_PREFIXES));
    const sinNamespace = Object.keys(IMAGE_PRESETS).filter((k) => !conNamespace.has(k));
    expect(sinNamespace).toEqual([]);
  });
});
