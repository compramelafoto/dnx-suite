import { describe, expect, it } from "vitest";
import { etiquetaPeriodo, hoyEnBuenosAires, resolverPeriodo } from "./periodos";

const iso = (r: { desde: Date; hasta: Date } | null) => r && [r.desde.toISOString(), r.hasta.toISOString()];

describe("hoyEnBuenosAires", () => {
  it("a las 01:00 UTC todavía es el día anterior en Argentina", () => {
    expect(hoyEnBuenosAires(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09-30");
  });
});

describe("resolverPeriodo (hoy = miércoles 2026-09-30)", () => {
  const hoy = "2026-09-30";
  it("hoy", () => expect(iso(resolverPeriodo("hoy", hoy))).toEqual(["2026-09-30T03:00:00.000Z", "2026-10-01T02:59:59.999Z"]));
  it("esta semana arranca el lunes", () =>
    expect(iso(resolverPeriodo("esta-semana", hoy))).toEqual(["2026-09-28T03:00:00.000Z", "2026-10-05T02:59:59.999Z"]));
  it("semana pasada", () =>
    expect(iso(resolverPeriodo("semana-pasada", hoy))).toEqual(["2026-09-21T03:00:00.000Z", "2026-09-28T02:59:59.999Z"]));
  it("este mes", () =>
    expect(iso(resolverPeriodo("este-mes", hoy))).toEqual(["2026-09-01T03:00:00.000Z", "2026-10-01T02:59:59.999Z"]));
  it("mes pasado", () =>
    expect(iso(resolverPeriodo("mes-pasado", hoy))).toEqual(["2026-08-01T03:00:00.000Z", "2026-09-01T02:59:59.999Z"]));
  it("últimos 3 meses incluye el actual", () =>
    expect(iso(resolverPeriodo("ultimos-3-meses", hoy))).toEqual(["2026-07-01T03:00:00.000Z", "2026-10-01T02:59:59.999Z"]));
  it("este año", () =>
    expect(iso(resolverPeriodo("este-anio", hoy))).toEqual(["2026-01-01T03:00:00.000Z", "2027-01-01T02:59:59.999Z"]));
  it("año pasado", () =>
    expect(iso(resolverPeriodo("anio-pasado", hoy))).toEqual(["2025-01-01T03:00:00.000Z", "2026-01-01T02:59:59.999Z"]));
  it("mes pasado en enero cae en diciembre del año anterior", () =>
    expect(iso(resolverPeriodo("mes-pasado", "2026-01-15"))).toEqual(["2025-12-01T03:00:00.000Z", "2026-01-01T02:59:59.999Z"]));
  it("un domingo pertenece a la semana que empezó el lunes anterior", () =>
    expect(iso(resolverPeriodo("esta-semana", "2026-10-04"))).toEqual(["2026-09-28T03:00:00.000Z", "2026-10-05T02:59:59.999Z"]));
  it("rango explícito, las dos puntas incluidas", () =>
    expect(iso(resolverPeriodo("2026-02-01..2026-02-28", hoy))).toEqual(["2026-02-01T03:00:00.000Z", "2026-03-01T02:59:59.999Z"]));
  it("un día que no existe (31 de febrero) es inválido", () =>
    expect(resolverPeriodo("2026-02-31..2026-03-01", hoy)).toBeNull());
  it("valor inválido", () => expect(resolverPeriodo("ayer", hoy)).toBeNull());
});

describe("etiquetaPeriodo", () => {
  it("atajo y rango", () => {
    expect(etiquetaPeriodo("mes-pasado")).toBe("Mes pasado");
    expect(etiquetaPeriodo("2026-02-01..2026-02-28")).toBe("01/02/2026 al 28/02/2026");
  });
});
