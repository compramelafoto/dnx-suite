import { describe, expect, it } from "vitest";
import {
  INTEGRATIONS_GOOGLE_CLIENT_ID_ENV,
  INTEGRATIONS_GOOGLE_CLIENT_SECRET_ENV,
  readIntegrationsGoogleCredentials,
} from "./credentials";

const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;

describe("qué cliente de Google usan las integraciones", () => {
  it("usa el propio cuando está configurado", () => {
    const r = readIntegrationsGoogleCredentials(
      env({
        [INTEGRATIONS_GOOGLE_CLIENT_ID_ENV]: "propio.apps.googleusercontent.com",
        [INTEGRATIONS_GOOGLE_CLIENT_SECRET_ENV]: "secreto-propio",
        GOOGLE_CLIENT_ID: "compartido.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "secreto-compartido",
      }),
    );
    expect(r).toEqual({
      clientId: "propio.apps.googleusercontent.com",
      clientSecret: "secreto-propio",
      dedicated: true,
    });
  });

  it("cae al compartido del login cuando no hay uno propio", () => {
    // Así la integración sigue funcionando mientras no exista el cliente separado.
    const r = readIntegrationsGoogleCredentials(
      env({ GOOGLE_CLIENT_ID: "compartido", GOOGLE_CLIENT_SECRET: "secreto" }),
    );
    expect(r).toEqual({ clientId: "compartido", clientSecret: "secreto", dedicated: false });
  });

  it("un cliente propio a medio configurar NO se mezcla con el compartido", () => {
    // Mezclar el id de uno con el secreto del otro da un error de Google imposible de
    // diagnosticar. Si falta la mitad, se usa el compartido entero.
    const r = readIntegrationsGoogleCredentials(
      env({
        [INTEGRATIONS_GOOGLE_CLIENT_ID_ENV]: "propio",
        GOOGLE_CLIENT_ID: "compartido",
        GOOGLE_CLIENT_SECRET: "secreto",
      }),
    );
    expect(r).toEqual({ clientId: "compartido", clientSecret: "secreto", dedicated: false });
  });

  it("sin ninguno de los dos devuelve null, no una credencial a medias", () => {
    expect(readIntegrationsGoogleCredentials(env({}))).toBeNull();
    expect(readIntegrationsGoogleCredentials(env({ GOOGLE_CLIENT_ID: "solo-id" }))).toBeNull();
  });

  it("los espacios de más no cuentan como valor", () => {
    expect(
      readIntegrationsGoogleCredentials(env({ GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "x" })),
    ).toBeNull();
  });
});
