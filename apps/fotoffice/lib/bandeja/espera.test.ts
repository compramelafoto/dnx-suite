import { describe, expect, it } from "vitest";
import { esperaDe, textoDeEspera } from "./espera";

const AHORA = new Date("2026-11-24T15:00:00.000Z");
const min = (n: number) => new Date(AHORA.getTime() - n * 60_000);
const chat = (p: Record<string, unknown> = {}) => ({ estado: "HUMANO" as const, atiendeElBot: false, ultimoEntranteEn: min(10), ultimoMensajeEn: min(10), ...p });

describe("esperaDe", () => {
  it("cortes: hasta 15 normal, de 15 a 60 atención, más de 60 urgente", () => {
    expect(esperaDe(chat({ ultimoEntranteEn: min(14), ultimoMensajeEn: min(14) }), AHORA)).toEqual({ minutos: 14, nivel: "normal" });
    expect(esperaDe(chat({ ultimoEntranteEn: min(15), ultimoMensajeEn: min(15) }), AHORA)?.nivel).toBe("atencion");
    expect(esperaDe(chat({ ultimoEntranteEn: min(60), ultimoMensajeEn: min(60) }), AHORA)?.nivel).toBe("atencion");
    expect(esperaDe(chat({ ultimoEntranteEn: min(61), ultimoMensajeEn: min(61) }), AHORA)?.nivel).toBe("urgente");
  });
  it("no espera: lo atiende el bot, está resuelto, ya se le respondió o nunca escribió", () => {
    expect(esperaDe(chat({ atiendeElBot: true }), AHORA)).toBeNull();
    expect(esperaDe(chat({ estado: "RESUELTO" }), AHORA)).toBeNull();
    expect(esperaDe(chat({ ultimoEntranteEn: min(20), ultimoMensajeEn: min(5) }), AHORA)).toBeNull();
    expect(esperaDe(chat({ ultimoEntranteEn: null }), AHORA)).toBeNull();
  });
});

describe("textoDeEspera", () => {
  it("minutos, horas y días", () => {
    expect(textoDeEspera(0)).toBe("espera hace menos de 1 min");
    expect(textoDeEspera(12)).toBe("espera hace 12 min");
    expect(textoDeEspera(90)).toBe("espera hace 1 h 30 min");
    expect(textoDeEspera(60 * 26)).toBe("espera hace 1 día");
    expect(textoDeEspera(60 * 24 * 3)).toBe("espera hace 3 días");
  });
});
