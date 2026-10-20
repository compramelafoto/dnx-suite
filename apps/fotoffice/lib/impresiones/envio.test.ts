import { describe, expect, it } from "vitest";
import { coordenadasDelEstudio, cotizarEnvio, puntoValido } from "./envio";

// Monumento a la Bandera (Rosario) y la plaza de Funes: unos 17 km en línea recta.
const ROSARIO = { lat: -32.9476, lon: -60.6305 };
const FUNES = { lat: -32.9167, lon: -60.8097 };
const base = { estudio: ROSARIO, destino: FUNES, baseCents: 100000, porKmCents: 50000, maxKm: null };

describe("cotizarEnvio", () => {
  it("Rosario centro → Funes: línea recta × 1,3, redondeada a un decimal", () => {
    const r = cotizarEnvio(base);
    if (!r.ok) throw new Error("debería cotizar");
    // ~17 km en línea recta → ~22 km de ida por calle.
    expect(r.km).toBeGreaterThan(20);
    expect(r.km).toBeLessThan(24);
    expect(Math.round(r.km * 10)).toBe(r.km * 10);
    expect(r.cents).toBe(100000 + Math.round(r.km * 50000));
  });
  it("el mismo punto cuesta sólo la base", () => {
    expect(cotizarEnvio({ ...base, destino: ROSARIO })).toEqual({ ok: true, km: 0, cents: 100000 });
  });
  it("redondea los centavos al entero", () => {
    const r = cotizarEnvio({ ...base, baseCents: 0, porKmCents: 333 });
    if (!r.ok) throw new Error("debería cotizar");
    expect(Number.isInteger(r.cents)).toBe(true);
    expect(r.cents).toBe(Math.round(r.km * 333));
  });
  it("más lejos que el máximo: fuera de radio", () => {
    expect(cotizarEnvio({ ...base, maxKm: 10 })).toEqual({ ok: false, motivo: "FUERA_DE_RADIO" });
  });
  it("justo en el máximo se ofrece", () => {
    const r = cotizarEnvio(base);
    if (!r.ok) throw new Error("debería cotizar");
    expect(cotizarEnvio({ ...base, maxKm: r.km }).ok).toBe(true);
  });
  it("sin ubicación del estudio no se cotiza", () => {
    expect(cotizarEnvio({ ...base, estudio: null })).toEqual({ ok: false, motivo: "SIN_ESTUDIO" });
  });
  it("sin destino (o con coordenadas imposibles) no se cotiza", () => {
    expect(cotizarEnvio({ ...base, destino: null })).toEqual({ ok: false, motivo: "SIN_DESTINO" });
    expect(cotizarEnvio({ ...base, destino: { lat: 95, lon: 0 } })).toEqual({ ok: false, motivo: "SIN_DESTINO" });
    expect(cotizarEnvio({ ...base, destino: { lat: Number.NaN, lon: 0 } })).toEqual({ ok: false, motivo: "SIN_DESTINO" });
  });
});

describe("puntoValido", () => {
  it("acepta coordenadas reales y rechaza el resto", () => {
    expect(puntoValido(ROSARIO.lat, ROSARIO.lon)).toBe(true);
    expect(puntoValido(-91, 0)).toBe(false);
    expect(puntoValido(0, 181)).toBe(false);
    expect(puntoValido(Number.POSITIVE_INFINITY, 0)).toBe(false);
    expect(puntoValido("1" as unknown, 0)).toBe(false);
  });
});

describe("coordenadasDelEstudio", () => {
  it("lee la ubicación del perfil de precios (con coma o punto)", () => {
    expect(coordenadasDelEstudio({ studioLatitude: "-32,9476", studioLongitude: "-60.6305" })).toEqual(ROSARIO);
  });
  it("vacía o inválida: null", () => {
    expect(coordenadasDelEstudio(null)).toBeNull();
    expect(coordenadasDelEstudio({ studioLatitude: "", studioLongitude: "-60" })).toBeNull();
    expect(coordenadasDelEstudio({ studioLatitude: "abc", studioLongitude: "-60" })).toBeNull();
    expect(coordenadasDelEstudio({ studioLatitude: "-100", studioLongitude: "-60" })).toBeNull();
  });
});
