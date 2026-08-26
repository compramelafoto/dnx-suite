import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron-auth";

const secreto = "un-secreto-largo-y-dificil";

describe("isAuthorizedCronRequest", () => {
  it("acepta el secreto correcto", () => {
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: `Bearer ${secreto}`,
        allowedSecrets: [secreto],
      }),
    ).toBe(true);
  });

  it("sin ningún secreto configurado, no entra nadie", () => {
    // Una ruta que corre sola y toca dinero no puede quedar abierta porque falte una
    // variable de entorno. Con la lista vacía, ni siquiera una cadena vacía entra.
    expect(
      isAuthorizedCronRequest({ authorizationHeader: "Bearer lo-que-sea", allowedSecrets: [] }),
    ).toBe(false);
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: "Bearer ",
        allowedSecrets: [undefined, "", "   "],
      }),
    ).toBe(false);
  });

  it("rechaza un secreto que no coincide", () => {
    expect(
      isAuthorizedCronRequest({ authorizationHeader: "Bearer otro", allowedSecrets: [secreto] }),
    ).toBe(false);
  });

  it("rechaza sin encabezado o con otro esquema", () => {
    expect(isAuthorizedCronRequest({ authorizationHeader: null, allowedSecrets: [secreto] })).toBe(false);
    expect(isAuthorizedCronRequest({ authorizationHeader: "", allowedSecrets: [secreto] })).toBe(false);
    expect(
      isAuthorizedCronRequest({ authorizationHeader: `Basic ${secreto}`, allowedSecrets: [secreto] }),
    ).toBe(false);
    expect(
      isAuthorizedCronRequest({ authorizationHeader: secreto, allowedSecrets: [secreto] }),
    ).toBe(false);
  });

  it("acepta cualquiera de los secretos configurados", () => {
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: "Bearer segundo",
        allowedSecrets: ["primero", "segundo"],
      }),
    ).toBe(true);
  });

  it("un secreto vacío en la lista no habilita un pedido sin token", () => {
    expect(
      isAuthorizedCronRequest({ authorizationHeader: "Bearer ", allowedSecrets: ["", secreto] }),
    ).toBe(false);
  });
});
