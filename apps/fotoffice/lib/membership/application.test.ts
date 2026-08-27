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

describe("parseApplication — fecha de nacimiento", () => {
  it("la acepta y la deja como fecha", () => {
    const r = parseApplication({ ...valida, birthDate: "1985-11-16" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.birthDate?.toISOString().slice(0, 10)).toBe("1985-11-16");
  });

  it("es opcional: sin ella la solicitud sigue siendo válida", () => {
    const r = parseApplication(valida);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.birthDate).toBeNull();
  });

  it("rechaza una fecha futura", () => {
    const r = parseApplication({ ...valida, birthDate: "2999-01-01" });
    expect(r.ok).toBe(false);
  });

  /** El padrón migrado ya trajo fechas imposibles: conviene cortarlas en la puerta. */
  it("rechaza una fecha absurda por lo vieja", () => {
    const r = parseApplication({ ...valida, birthDate: "1850-01-01" });
    expect(r.ok).toBe(false);
  });

  it("rechaza un texto que no es una fecha", () => {
    const r = parseApplication({ ...valida, birthDate: "el año pasado" });
    expect(r.ok).toBe(false);
  });
});

describe("parseApplication — credencial impresa", () => {
  it("por omisión no la pide", () => {
    const r = parseApplication(valida);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.wantsPrintedCard).toBe(false);
  });

  it("la marca cuando el formulario la manda tildada", () => {
    const r = parseApplication({ ...valida, wantsPrintedCard: "on" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.wantsPrintedCard).toBe(true);
  });

  it("acepta también un booleano", () => {
    const r = parseApplication({ ...valida, wantsPrintedCard: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.wantsPrintedCard).toBe(true);
  });
});
