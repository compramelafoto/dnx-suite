import { describe, expect, it } from "vitest";
import { codigoDeReferidoParaAlta } from "./decidir";

describe("codigoDeReferidoParaAlta", () => {
  it("devuelve el código normalizado cuando la cuenta se acaba de crear", () => {
    expect(codigoDeReferidoParaAlta({ cuentaCreada: true, cookie: " abc123 " })).toBe("ABC123");
  });

  it("no avisa si la cuenta ya existía", () => {
    expect(codigoDeReferidoParaAlta({ cuentaCreada: false, cookie: "ABC123" })).toBeNull();
  });

  it("no avisa sin cookie o con un código inválido", () => {
    expect(codigoDeReferidoParaAlta({ cuentaCreada: true, cookie: undefined })).toBeNull();
    expect(codigoDeReferidoParaAlta({ cuentaCreada: true, cookie: null })).toBeNull();
    expect(codigoDeReferidoParaAlta({ cuentaCreada: true, cookie: "a" })).toBeNull();
    expect(codigoDeReferidoParaAlta({ cuentaCreada: true, cookie: "<script>" })).toBeNull();
  });
});
