import { describe, expect, it } from "vitest";
import { normalizeTrackingNumber, trackingUrl } from "./tracking";

describe("normalizeTrackingNumber", () => {
  it("vacío o sólo espacios: sin número (es opcional)", () => {
    expect(normalizeTrackingNumber(null)).toEqual({ ok: true, value: null });
    expect(normalizeTrackingNumber(undefined)).toEqual({ ok: true, value: null });
    expect(normalizeTrackingNumber("   ")).toEqual({ ok: true, value: null });
  });

  it("recorta espacios y acepta letras, números y guiones", () => {
    expect(normalizeTrackingNumber("  CP123456789AR ")).toEqual({ ok: true, value: "CP123456789AR" });
    expect(normalizeTrackingNumber("000-123-abc")).toEqual({ ok: true, value: "000-123-abc" });
  });

  it("rechaza otros caracteres y más de 60", () => {
    for (const malo of ["CP 123", "<b>1</b>", "12/34", "123.45", "ñandú1", "a".repeat(61)]) {
      expect(normalizeTrackingNumber(malo)).toEqual({ ok: false, error: "Revisá el número de seguimiento." });
    }
    expect(normalizeTrackingNumber("a".repeat(60))).toEqual({ ok: true, value: "a".repeat(60) });
  });
});

describe("trackingUrl", () => {
  it("sólo para Correo Argentino y con número", () => {
    expect(trackingUrl("CORREO_ARGENTINO", "CP123AR")).toBe(
      "https://www.correoargentino.com.ar/formularios/e-commerce?id=CP123AR",
    );
    expect(trackingUrl("TABLE", "CP123AR")).toBeNull();
    expect(trackingUrl(null, "CP123AR")).toBeNull();
    expect(trackingUrl("CORREO_ARGENTINO", null)).toBeNull();
  });

  it("el número va codificado aunque llegue algo raro de la base", () => {
    expect(trackingUrl("CORREO_ARGENTINO", "a&b=c")).toBe(
      "https://www.correoargentino.com.ar/formularios/e-commerce?id=a%26b%3Dc",
    );
  });
});
