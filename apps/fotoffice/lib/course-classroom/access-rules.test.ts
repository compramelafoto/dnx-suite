import { describe, expect, it } from "vitest";
import {
  calcularVencimiento,
  estadoDeAccesoAlCurso,
  fechaLegibleArgentina,
  numeroDeInscripcion,
} from "./access-rules";

describe("vencimiento del acceso", () => {
  it("doce meses desde la compra", () => {
    const desde = new Date(Date.UTC(2026, 9, 3, 15));
    expect(calcularVencimiento(desde, 12).toISOString()).toBe("2027-10-03T15:00:00.000Z");
  });

  it("un 31 más un mes cae en el último día del mes siguiente, no en marzo", () => {
    const desde = new Date(Date.UTC(2026, 0, 31, 10));
    expect(calcularVencimiento(desde, 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
  });

  it("un valor absurdo de meses no deja un acceso que vence al comprarlo", () => {
    const desde = new Date(Date.UTC(2026, 9, 3));
    expect(calcularVencimiento(desde, 0).toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });

  it("meses que no son un número finito se toman como un mes, no como fecha inválida", () => {
    const desde = new Date(Date.UTC(2026, 9, 3));
    expect(calcularVencimiento(desde, Number.NaN).toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(calcularVencimiento(desde, Infinity).toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });
});

describe("número de inscripción para la marca de agua", () => {
  it("los últimos seis caracteres, en mayúsculas", () => {
    expect(numeroDeInscripcion("cmg1abcdefxyz123")).toBe("XYZ123");
  });
});

describe("fecha para el alumno", () => {
  it("en hora argentina: las 2 de la mañana UTC del 4 son todavía el 3", () => {
    expect(fechaLegibleArgentina(new Date(Date.UTC(2027, 9, 4, 2)))).toBe("3 de octubre de 2027");
  });
});

describe("cuándo vale un acceso al curso", () => {
  const ahora = new Date(Date.UTC(2026, 9, 4));
  const vence = new Date(Date.UTC(2027, 9, 4));

  it("comprado y no vencido: vale, sea socio o no", () => {
    const acceso = { origin: "PURCHASE" as const, expiresAt: vence, revokedAt: null };
    expect(estadoDeAccesoAlCurso(acceso, { esSocioActivo: false }, ahora)).toBe("VIGENTE");
    expect(estadoDeAccesoAlCurso(acceso, { esSocioActivo: true }, ahora)).toBe("VIGENTE");
  });

  it("comprado y vencido: no vale aunque sea socio", () => {
    const acceso = { origin: "PURCHASE" as const, expiresAt: ahora, revokedAt: null };
    expect(estadoDeAccesoAlCurso(acceso, { esSocioActivo: true }, ahora)).toBe("VENCIDO");
  });

  it("de beneficio: vale sólo mientras es socio activo, sin vencimiento por fecha", () => {
    const acceso = { origin: "MEMBER_BENEFIT" as const, expiresAt: null, revokedAt: null };
    expect(estadoDeAccesoAlCurso(acceso, { esSocioActivo: true }, ahora)).toBe("VIGENTE");
    expect(estadoDeAccesoAlCurso(acceso, { esSocioActivo: false }, ahora)).toBe("SIN_SOCIO");
  });

  it("revocado gana sobre todo", () => {
    const revokedAt = new Date(Date.UTC(2026, 9, 1));
    expect(
      estadoDeAccesoAlCurso({ origin: "PURCHASE", expiresAt: vence, revokedAt }, { esSocioActivo: true }, ahora),
    ).toBe("REVOCADO");
    expect(
      estadoDeAccesoAlCurso({ origin: "MEMBER_BENEFIT", expiresAt: null, revokedAt }, { esSocioActivo: true }, ahora),
    ).toBe("REVOCADO");
  });

  it("una compra sin fecha de vencimiento (dato roto) no castiga a quien pagó", () => {
    expect(
      estadoDeAccesoAlCurso({ origin: "PURCHASE", expiresAt: null, revokedAt: null }, { esSocioActivo: false }, ahora),
    ).toBe("VIGENTE");
  });
});
