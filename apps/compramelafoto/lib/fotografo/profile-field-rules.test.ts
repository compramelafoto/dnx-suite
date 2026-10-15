import { describe, expect, it } from "vitest";
import { normalizeDefaultDigitalPrice, normalizeHexColor, normalizePublicPageHandler } from "./profile-field-rules";

describe("reglas del perfil", () => {
  it("color", () => {
    expect(normalizeHexColor("#AABBCC")).toEqual({ set: true, value: "#AABBCC" });
    expect(normalizeHexColor(" #aabbcc ")).toEqual({ set: true, value: "#aabbcc" });
    expect(normalizeHexColor("")).toEqual({ set: true, value: null });
    expect(normalizeHexColor("rojo")).toEqual({ set: false });
  });
  it("color null se ignora (así se comporta la ruta hoy)", () => {
    expect(normalizeHexColor(null)).toEqual({ set: false });
  });
  it("handler", () => {
    expect(normalizePublicPageHandler(" Mi-Estudio ")).toEqual({ ok: true, value: "mi-estudio" });
    expect(normalizePublicPageHandler("mi estudio")).toEqual({ ok: false, error: "El handler solo puede contener letras, números y guiones" });
    expect(normalizePublicPageHandler("")).toEqual({ ok: true, value: null });
    expect(normalizePublicPageHandler(null)).toEqual({ ok: true, value: null });
  });
  it("precio por defecto", () => {
    expect(normalizeDefaultDigitalPrice(100, 5000)).toEqual({
      ok: false,
      error: "El precio por foto digital no puede ser menor al mínimo del sistema (5000 pesos)",
    });
    expect(normalizeDefaultDigitalPrice(0, 5000)).toEqual({ ok: true, value: 5000 });
    expect(normalizeDefaultDigitalPrice(7000, 5000)).toEqual({ ok: true, value: 7000 });
  });
  it("precio por defecto inválido o negativo → el mínimo (así se comporta la ruta hoy)", () => {
    expect(normalizeDefaultDigitalPrice("abc", 5000)).toEqual({ ok: true, value: 5000 });
    expect(normalizeDefaultDigitalPrice(-10, 5000)).toEqual({ ok: true, value: 5000 });
    expect(normalizeDefaultDigitalPrice(null, 5000)).toEqual({ ok: true, value: 5000 });
  });
});
