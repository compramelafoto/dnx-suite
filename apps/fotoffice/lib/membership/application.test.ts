import { describe, expect, it } from "vitest";
import { parseApplication } from "./application";

const valida = {
  firstName: "Ana",
  lastName: "Fotógrafa",
  documentType: "DNI",
  documentNumber: "30111222",
  email: "ana@test.com",
  phone: "3410000000",
  noticeAddress: "San Martín 1234",
  city: "Rosario",
  declaredFeeScale: "PLENA",
};

describe("parseApplication", () => {
  it("acepta una solicitud completa", () => {
    const r = parseApplication(valida);
    expect(r.ok).toBe(true);
  });

  it("normaliza el email a minúsculas y sin espacios", () => {
    const r = parseApplication({ ...valida, email: "  ANA@Test.COM  " });
    expect(r.ok && r.data.email).toBe("ana@test.com");
  });

  it("recorta espacios de los nombres", () => {
    const r = parseApplication({ ...valida, firstName: "  Ana  " });
    expect(r.ok && r.data.firstName).toBe("Ana");
  });

  it.each([
    ["sin nombre", { firstName: "" }],
    ["sin apellido", { lastName: "" }],
    ["sin email", { email: "" }],
    ["email inválido", { email: "no-es-un-email" }],
  ])("rechaza una solicitud %s", (_label, override) => {
    const r = parseApplication({ ...valida, ...override });
    expect(r.ok).toBe(false);
  });

  /**
   * Sin domicilio de notificaciones no se puede cursar una intimación, y sin intimación la
   * baja por deuda es nula. Pedirlo dos años después, con el socio ya en deuda, es
   * impracticable: se exige en el alta.
   */
  it("exige domicilio de notificaciones", () => {
    const r = parseApplication({ ...valida, noticeAddress: "" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/domicilio/i);
  });

  it("quien declara escala reducida debe decir de qué institución", () => {
    const r = parseApplication({ ...valida, declaredFeeScale: "REDUCIDA" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/instituci[óo]n/i);
  });

  it("con institución declarada, la escala reducida se acepta", () => {
    const r = parseApplication({
      ...valida,
      declaredFeeScale: "REDUCIDA",
      originInstitution: "Escuela de Fotografía",
    });
    expect(r.ok).toBe(true);
  });

  it("una escala inventada se rechaza", () => {
    const r = parseApplication({ ...valida, declaredFeeScale: "GRATIS" });
    expect(r.ok).toBe(false);
  });

  /** Nadie se asocia declarando que no paga: la exención la otorga la institución. */
  it("no se puede declarar escala exenta desde el formulario", () => {
    const r = parseApplication({ ...valida, declaredFeeScale: "EXENTA" });
    expect(r.ok).toBe(false);
  });

  it("acepta un monto propio para quien aporta libremente", () => {
    const r = parseApplication({ ...valida, ownDuesAmount: "15000" });
    expect(r.ok && r.data.ownDuesAmount?.toFixed(2)).toBe("15000.00");
  });

  it.each(["-100", "abc", "0"])("rechaza un monto propio inválido (%s)", (monto) => {
    const r = parseApplication({ ...valida, ownDuesAmount: monto });
    expect(r.ok).toBe(false);
  });

  it("los campos opcionales pueden faltar", () => {
    const r = parseApplication({
      firstName: "Ana",
      lastName: "Fotógrafa",
      email: "ana@test.com",
      noticeAddress: "San Martín 1234",
      declaredFeeScale: "PLENA",
    });
    expect(r.ok).toBe(true);
  });

  it("un texto excesivamente largo se rechaza en vez de truncarse", () => {
    const r = parseApplication({ ...valida, firstName: "a".repeat(500) });
    expect(r.ok).toBe(false);
  });
});
