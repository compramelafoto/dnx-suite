import { describe, expect, it } from "vitest";
import { fechaCorta, fechaHora, prizeStatusLabel, raffleStatusLabel } from "./labels";

describe("cómo se nombra cada estado", () => {
  it("nunca le muestra a nadie la palabra en mayúsculas con guiones bajos", () => {
    for (const s of [
      "BORRADOR",
      "ANUNCIADO",
      "PADRON_SELLADO",
      "SORTEADO",
      "CERRADO",
      "CANCELADO",
    ]) {
      expect(raffleStatusLabel(s)).not.toContain("_");
      expect(raffleStatusLabel(s)).not.toBe(s);
    }
  });

  it("el padrón sellado se explica, no se nombra", () => {
    expect(raffleStatusLabel("PADRON_SELLADO")).toBe("Padrón cerrado, esperando el acto");
  });

  it("los premios también", () => {
    expect(prizeStatusLabel("NO_RETIRADO")).toBe("No lo retiró");
    expect(prizeStatusLabel("GANADO")).toBe("Ganado, falta avisarle");
    for (const s of ["GANADO", "NOTIFICADO", "RETIRADO", "NO_RETIRADO", "ANULADO"]) {
      expect(prizeStatusLabel(s)).not.toContain("_");
    }
  });

  it("un estado desconocido vuelve tal cual en vez de romper la pantalla", () => {
    expect(raffleStatusLabel("ALGO_NUEVO")).toBe("ALGO_NUEVO");
  });
});

describe("las fechas", () => {
  it("se leen en hora argentina y no en la del servidor", () => {
    // 2026-09-30T23:00Z son las 20:00 del 30 en Buenos Aires.
    expect(fechaHora(new Date("2026-09-30T23:00:00Z"))).toContain("30/09/2026");
    expect(fechaHora(new Date("2026-09-30T23:00:00Z"))).toContain("20:00");
  });

  it("la hora va de corrido, sin a. m. ni p. m.", () => {
    expect(fechaHora(new Date("2026-09-30T23:00:00Z"))).not.toMatch(/m\./);
  });

  it("la fecha corta no muestra hora", () => {
    expect(fechaCorta(new Date("2026-10-31T23:59:59Z"))).toBe("31/10/2026");
  });
});
