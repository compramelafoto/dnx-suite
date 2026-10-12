import { describe, expect, it } from "vitest";
import { decidirEnvio, periodoMes, periodosFinDeSemana, periodosMensuales, PRIMERA_COMPARATIVA } from "./periodos";

describe("períodos de la comparativa", () => {
  it("fin de semana: 12/10 al 17/10 contra los 6 días anteriores, en medianoches argentinas", () => {
    const { actual, anterior } = periodosFinDeSemana();
    expect(actual).toMatchObject({ desde: "2026-10-12", hasta: "2026-10-17", dias: 6 });
    expect(actual.inicio.toISOString()).toBe("2026-10-12T03:00:00.000Z");
    expect(actual.fin.toISOString()).toBe("2026-10-18T03:00:00.000Z");
    expect(anterior).toMatchObject({ desde: "2026-10-06", hasta: "2026-10-11", dias: 6 });
    expect(anterior.fin.getTime()).toBe(actual.inicio.getTime());
  });
  it("mensual el 1/11: octubre contra septiembre y promedio de septiembre, agosto y julio", () => {
    const p = periodosMensuales(new Date("2026-11-01T13:00:00Z"));
    expect(p.actual).toMatchObject({ desde: "2026-10-01", hasta: "2026-10-31", dias: 31 });
    expect(p.actual.fin.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(p.anterior).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-30", dias: 30 });
    expect(p.previos.map((x) => x.desde)).toEqual(["2026-09-01", "2026-08-01", "2026-07-01"]);
  });
  it("mensual cruzando el año: el 1/1/2027 informa diciembre 2026", () => {
    const p = periodosMensuales(new Date("2027-01-01T13:00:00Z"));
    expect(p.actual).toMatchObject({ desde: "2026-12-01", hasta: "2026-12-31" });
    expect(p.actual.fin.toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(p.anterior.desde).toBe("2026-11-01");
    expect(p.previos.map((x) => x.desde)).toEqual(["2026-11-01", "2026-10-01", "2026-09-01"]);
  });
  it("borde de zona horaria: 02:30 UTC del 1/11 todavía es 31/10 en Argentina", () => {
    expect(periodosMensuales(new Date("2026-11-01T02:30:00Z")).actual.desde).toBe("2026-09-01");
    expect(periodosMensuales(new Date("2026-11-01T03:00:00Z")).actual.desde).toBe("2026-10-01");
  });
  it("febrero de 28 días", () => {
    expect(periodoMes("2027-02")).toMatchObject({ hasta: "2027-02-28", dias: 28 });
  });
});

describe("decidirEnvio", () => {
  it("el 18/10/2026 en Argentina manda la de fin de semana", () => {
    expect(PRIMERA_COMPARATIVA).toBe("2026-10-18");
    expect(decidirEnvio(new Date("2026-10-18T13:00:00Z"))).toBe("fin_de_semana");
  });
  it("el día 1 manda la mensual", () => {
    expect(decidirEnvio(new Date("2026-11-01T13:00:00Z"))).toBe("mensual");
    expect(decidirEnvio(new Date("2027-01-01T13:00:00Z"))).toBe("mensual");
  });
  it("cualquier otro día no manda", () => {
    expect(decidirEnvio(new Date("2026-10-17T13:00:00Z"))).toBeNull();
    expect(decidirEnvio(new Date("2026-11-02T13:00:00Z"))).toBeNull();
    expect(decidirEnvio(new Date("2026-11-18T13:00:00Z"))).toBeNull();
  });
  it("borde de zona horaria: 01:00 UTC del 19/10 todavía es 18/10 y 02:00 UTC del 1/12 todavía es 30/11", () => {
    expect(decidirEnvio(new Date("2026-10-19T01:00:00Z"))).toBe("fin_de_semana");
    expect(decidirEnvio(new Date("2026-12-01T02:00:00Z"))).toBeNull();
  });
  it("forzada: elige por fecha o respeta el tipo pedido", () => {
    expect(decidirEnvio(new Date("2026-10-12T13:00:00Z"), { forzar: true })).toBe("fin_de_semana");
    expect(decidirEnvio(new Date("2026-11-12T13:00:00Z"), { forzar: true })).toBe("mensual");
    expect(decidirEnvio(new Date("2026-10-12T13:00:00Z"), { forzar: true, tipo: "mensual" })).toBe("mensual");
    // Sin forzar, el tipo pedido no alcanza para mandar.
    expect(decidirEnvio(new Date("2026-10-12T13:00:00Z"), { tipo: "mensual" })).toBeNull();
  });
});
