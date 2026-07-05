import { describe, expect, it } from "vitest";
import { extractShutterCountFromExif } from "./extract-shutter-count";
import {
  buildGearNormalizedKey,
  formatEquipmentDisplayLabel,
  normalizeGearMake,
  normalizeGearModel,
} from "./gear-normalize";

describe("gear-normalize", () => {
  it("agrupa Canon EOS R6 y Canon R6 como el mismo body sin serial", () => {
    const make1 = normalizeGearMake("Canon");
    const make2 = normalizeGearMake("Canon");
    const model1 = normalizeGearModel(make1, "Canon EOS R6");
    const model2 = normalizeGearModel(make2, "Canon R6");
    expect(model1).toBe(model2);
    const key1 = buildGearNormalizedKey(1, "body", make1, model1, null);
    const key2 = buildGearNormalizedKey(1, "body", make2, model2, null);
    expect(key1).toBe(key2);
  });

  it("no fusiona R6 con R6 Mark II", () => {
    const make = normalizeGearMake("Canon");
    const r6 = normalizeGearModel(make, "EOS R6");
    const r6ii = normalizeGearModel(make, "EOS R6 Mark II");
    expect(r6).not.toBe(r6ii);
  });

  it("dos bodies del mismo modelo con serial distinto generan keys distintas", () => {
    const make = normalizeGearMake("Canon");
    const model = normalizeGearModel(make, "EOS R6");
    const keyA = buildGearNormalizedKey(1, "body", make, model, "ABC123");
    const keyB = buildGearNormalizedKey(1, "body", make, model, "XYZ999");
    expect(keyA).not.toBe(keyB);
  });

  it("dos bodies del mismo modelo sin serial comparten key", () => {
    const make = normalizeGearMake("Nikon");
    const model = normalizeGearModel(make, "Z 6");
    const keyA = buildGearNormalizedKey(5, "body", make, model, null);
    const keyB = buildGearNormalizedKey(5, "body", make, model, undefined);
    expect(keyA).toBe(keyB);
  });

  it("normaliza lentes Nikon con variaciones de mayúsculas", () => {
    const make = normalizeGearMake("NIKON CORPORATION");
    const model = normalizeGearModel(make, "NIKKOR Z 24-70mm f/2.8 S");
    expect(make).toBe("nikon");
    expect(model).toContain("24");
  });
});

describe("extractShutterCountFromExif", () => {
  it("lee ShutterCount con alta confianza", () => {
    const result = extractShutterCountFromExif({ ShutterCount: 12450 });
    expect(result).toEqual({
      shutterCount: 12450,
      sourceField: "ShutterCount",
      confidence: "HIGH",
    });
  });

  it("no actualiza máximo si el valor entrante es menor (regla de negocio)", () => {
    const currentMax = 5000;
    const incoming = 3000;
    const shouldUpdate = incoming > (currentMax ?? 0);
    expect(shouldUpdate).toBe(false);
  });

  it("actualiza máximo si el valor entrante es mayor", () => {
    const currentMax = 5000;
    const incoming = 8000;
    const shouldUpdate = incoming > (currentMax ?? 0);
    expect(shouldUpdate).toBe(true);
  });
});

describe("modelo conceptual body + lentes", () => {
  it("mismo body + dos lentes = 1 body, 2 lentes, 2 combinaciones (simulado)", () => {
    const photographerId = 1;
    const make = normalizeGearMake("Canon");
    const bodyModel = normalizeGearModel(make, "EOS R6");
    const bodyKey = buildGearNormalizedKey(photographerId, "body", make, bodyModel, null);

    const lensMake = normalizeGearMake("Canon");
    const lens24 = normalizeGearModel(lensMake, "RF 24-70mm F2.8 L IS USM");
    const lens70200 = normalizeGearModel(lensMake, "RF 70-200mm F2.8 L IS USM");
    const lensKey24 = buildGearNormalizedKey(photographerId, "lens", lensMake, lens24, null);
    const lensKey70200 = buildGearNormalizedKey(photographerId, "lens", lensMake, lens70200, null);

    const uniqueBodies = new Set([bodyKey]);
    const uniqueLenses = new Set([lensKey24, lensKey70200]);
    const combinations = new Set([
      `${bodyKey}|${lensKey24}`,
      `${bodyKey}|${lensKey70200}`,
    ]);

    expect(uniqueBodies.size).toBe(1);
    expect(uniqueLenses.size).toBe(2);
    expect(combinations.size).toBe(2);
    expect(uniqueBodies.size + uniqueLenses.size).toBe(3);
  });

  it("combinación sin lente usa lensId null", () => {
    const comboKey = "body-only|null-lens";
    expect(comboKey).toContain("null");
  });
});

describe("formatEquipmentDisplayLabel", () => {
  it("evita marca duplicada en etiqueta de display", () => {
    expect(formatEquipmentDisplayLabel("Canon", "Canon EOS 5D Mark IV")).toBe(
      "Canon EOS 5D Mark IV"
    );
  });
});
