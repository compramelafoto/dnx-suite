import { describe, expect, it } from "vitest";
import { etiquetaMes, inicioDeMes, inicioDelMesSiguiente, mesDeInstante, mesesEntre, periodoInforme, sumarMeses } from "./periodos";

const HOY = "2026-03-15";

describe("periodoInforme", () => {
  it("por omisión es este mes, sin aviso", () => {
    const p = periodoInforme({ hoy: HOY });
    expect(p).toMatchObject({ valor: "este-mes", meses: ["2026-03"], aviso: null });
  });
  it("atajos", () => {
    expect(periodoInforme({ periodo: "mes-pasado", hoy: HOY }).meses).toEqual(["2026-02"]);
    expect(periodoInforme({ periodo: "ultimos-3", hoy: HOY }).meses).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(periodoInforme({ periodo: "ultimos-6", hoy: HOY }).meses).toHaveLength(6);
    expect(periodoInforme({ periodo: "este-anio", hoy: HOY }).meses).toHaveLength(12);
    expect(periodoInforme({ periodo: "anio-pasado", hoy: HOY })).toMatchObject({ desde: "2025-01", hasta: "2025-12" });
  });
  it("cruza el año en los últimos meses", () => {
    expect(periodoInforme({ periodo: "ultimos-3", hoy: "2026-01-10" }).meses).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
  it("rango válido", () => {
    const p = periodoInforme({ periodo: "2025-11..2026-02", hoy: HOY });
    expect(p.meses).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(p.valor).toBe("2025-11..2026-02");
    expect(p.aviso).toBeNull();
  });
  it("24 meses sí, 25 no (vuelve a este mes con aviso)", () => {
    expect(periodoInforme({ periodo: "2024-03..2026-02", hoy: HOY }).meses).toHaveLength(24);
    const p = periodoInforme({ periodo: "2024-02..2026-02", hoy: HOY });
    expect(p.meses).toEqual(["2026-03"]);
    expect(p.aviso).toMatch(/24 meses/);
  });
  it("inválidos: al revés, mes imposible, basura", () => {
    for (const v of ["2026-05..2026-01", "2026-13..2026-14", "hola", "2026-01..", "2026-01..2026-02..2026-03"]) {
      const p = periodoInforme({ periodo: v, hoy: HOY });
      expect(p.valor).toBe("este-mes");
      expect(p.aviso).not.toBeNull();
    }
  });
});

describe("meses", () => {
  it("sumarMeses y mesesEntre cruzan el año", () => {
    expect(sumarMeses("2026-01", -1)).toBe("2025-12");
    expect(sumarMeses("2025-12", 2)).toBe("2026-02");
    expect(mesesEntre("2026-03", "2026-01")).toEqual([]);
  });
  it("etiqueta MM/AAAA", () => expect(etiquetaMes("2026-03")).toBe("03/2026"));
  it("el mes es el de Buenos Aires: 01/03 01:00 UTC todavía es febrero", () => {
    expect(mesDeInstante(new Date("2026-03-01T01:00:00Z"))).toBe("2026-02");
    expect(mesDeInstante(new Date("2026-03-01T03:00:00Z"))).toBe("2026-03");
  });
  it("límites de mes en hora argentina", () => {
    expect(inicioDeMes("2026-03").toISOString()).toBe("2026-03-01T03:00:00.000Z");
    expect(inicioDelMesSiguiente("2026-12").toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});
