import { describe, expect, it } from "vitest";
import { esPackDePreventa, faltaFechaMaxima } from "./fecha-maxima-compra";

describe("fecha máxima de compra", () => {
  it("los packs de preventa (o sin fase) la necesitan", () => {
    expect(faltaFechaMaxima({ availabilityPhase: "PRE_UPLOAD", validUntil: null })).toBe(true);
    expect(faltaFechaMaxima({ availabilityPhase: null, validUntil: undefined })).toBe(true);
    expect(faltaFechaMaxima({ availabilityPhase: "PRE_UPLOAD", validUntil: "2026-12-01T03:00:00.000Z" })).toBe(false);
  });
  it("los de después de subir las fotos se venden en la galería y no la necesitan", () => {
    expect(esPackDePreventa("POST_UPLOAD")).toBe(false);
    expect(faltaFechaMaxima({ availabilityPhase: "POST_UPLOAD", validUntil: null })).toBe(false);
  });
});
