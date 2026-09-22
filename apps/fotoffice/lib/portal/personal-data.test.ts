import { describe, expect, it } from "vitest";
import { parseDatosPersonales } from "./personal-data";

/** Lo que ya está guardado en la ficha. Se usa para no revalidar lo que nadie tocó. */
const actual = { documentType: "DNI", documentNumber: "12345678" };

const completo = {
  firstName: "María",
  lastName: "López",
  documentType: "DNI",
  documentNumber: "12345678",
  email: "maria@ejemplo.com",
  phone: "3415551234",
  birthDate: "1985-04-12",
  address: "Mitre 1234",
  city: "Rosario",
  province: "Santa Fe",
  postalCode: "2000",
};

const hoy = new Date("2026-09-22T12:00:00Z");

describe("parseDatosPersonales", () => {
  it("acepta una ficha completa y devuelve los campos listos para guardar", () => {
    const r = parseDatosPersonales(completo, actual, hoy);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.firstName).toBe("María");
    expect(r.data.lastName).toBe("López");
    expect(r.data.email).toBe("maria@ejemplo.com");
    expect(r.data.birthDate?.toISOString()).toBe("1985-04-12T00:00:00.000Z");
  });

  it("recorta los espacios de todos los campos de texto", () => {
    const r = parseDatosPersonales(
      { ...completo, firstName: "  María  ", city: "  Rosario " },
      actual,
      hoy,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.firstName).toBe("María");
    expect(r.data.city).toBe("Rosario");
  });

  /** Sin nombre no hay socio: es lo que sale impreso en la credencial. */
  it("exige nombre", () => {
    const r = parseDatosPersonales({ ...completo, firstName: "   " }, actual, hoy);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("firstName");
  });

  it("exige apellido", () => {
    const r = parseDatosPersonales({ ...completo, lastName: "" }, actual, hoy);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("lastName");
  });

  /**
   * El campo vacío es un dato válido: el padrón migrado tiene socios sin domicilio ni
   * teléfono, y borrar lo que se cargó mal tiene que poder hacerse.
   */
  it("guarda null, nunca cadena vacía, en los campos opcionales", () => {
    const r = parseDatosPersonales(
      { ...completo, phone: "", address: "  ", city: "", province: "", postalCode: "", email: "" },
      actual,
      hoy,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.phone).toBeNull();
    expect(r.data.address).toBeNull();
    expect(r.data.city).toBeNull();
    expect(r.data.province).toBeNull();
    expect(r.data.postalCode).toBeNull();
    expect(r.data.email).toBeNull();
  });

  it("normaliza el email a minúsculas", () => {
    const r = parseDatosPersonales({ ...completo, email: " Maria@Ejemplo.COM " }, actual, hoy);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.email).toBe("maria@ejemplo.com");
  });

  it("rechaza un email mal escrito", () => {
    const r = parseDatosPersonales({ ...completo, email: "maria arroba ejemplo" }, actual, hoy);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("email");
  });

  it("normaliza el documento: guarda solo los dígitos", () => {
    const r = parseDatosPersonales(
      { ...completo, documentType: "dni", documentNumber: "12.345.679" },
      actual,
      hoy,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.documentType).toBe("DNI");
    expect(r.data.documentNumber).toBe("12345679");
  });

  it("rechaza un documento nuevo con formato imposible", () => {
    const r = parseDatosPersonales({ ...completo, documentNumber: "123" }, actual, hoy);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("documentNumber");
  });

  /**
   * Validación NO retroactiva, igual que en el panel: quien quedó cargado hace años con un
   * documento que hoy no pasaría tiene que poder corregir su teléfono sin quedar trabado.
   */
  it("no revalida el documento si el socio no lo tocó", () => {
    const viejo = { documentType: "DNI", documentNumber: "999" };
    const r = parseDatosPersonales(
      { ...completo, documentType: "DNI", documentNumber: "999" },
      viejo,
      hoy,
    );
    expect(r.ok).toBe(true);
  });

  it("permite quedarse sin documento", () => {
    const r = parseDatosPersonales(
      { ...completo, documentType: "", documentNumber: "" },
      actual,
      hoy,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.documentType).toBeNull();
    expect(r.data.documentNumber).toBeNull();
  });

  it("interpreta la fecha de nacimiento del calendario sin correrla de día", () => {
    const r = parseDatosPersonales({ ...completo, birthDate: "1990-01-01" }, actual, hoy);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.birthDate?.toISOString()).toBe("1990-01-01T00:00:00.000Z");
  });

  it("acepta no declarar fecha de nacimiento", () => {
    const r = parseDatosPersonales({ ...completo, birthDate: "" }, actual, hoy);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.birthDate).toBeNull();
  });

  it("rechaza una fecha de nacimiento en el futuro", () => {
    const r = parseDatosPersonales({ ...completo, birthDate: "2030-01-01" }, actual, hoy);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("birthDate");
  });

  it("rechaza una fecha de nacimiento imposible", () => {
    const r = parseDatosPersonales({ ...completo, birthDate: "no-es-fecha" }, actual, hoy);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("birthDate");
  });

  it("rechaza un nombre desmedido", () => {
    const r = parseDatosPersonales({ ...completo, firstName: "a".repeat(101) }, actual, hoy);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("firstName");
  });

  /**
   * El número de socio no viaja en el formulario: aunque alguien lo agregue a mano al POST,
   * el parser no lo mira y nunca llega a la base.
   */
  it("ignora cualquier campo que no sea un dato personal", () => {
    const r = parseDatosPersonales(
      { ...completo, memberNumber: "1", status: "INACTIVE", notes: "hola" } as never,
      actual,
      hoy,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.data).sort()).toEqual(
      [
        "address",
        "birthDate",
        "city",
        "documentNumber",
        "documentType",
        "email",
        "firstName",
        "lastName",
        "phone",
        "postalCode",
        "province",
      ].sort(),
    );
  });
});
