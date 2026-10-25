import { describe, expect, it } from "vitest";
import { compuertaDeEnvio } from "./compuerta";

describe("compuertaDeEnvio", () => {
  const llaves = { RESEND_API_KEY: "re_x", MUESTRAS_CORREOS_EN_VIVO: "true", MUESTRAS_EMAIL_FROM: "Muestras <hola@muestrasfotograficas.com>" };
  it("con las dos llaves y remitente, envía", () => expect(compuertaDeEnvio(llaves)).toEqual({ puede: true, apiKey: "re_x", from: llaves.MUESTRAS_EMAIL_FROM }));
  it("sin clave no envía", () => expect(compuertaDeEnvio({ ...llaves, RESEND_API_KEY: "" }).puede).toBe(false));
  it("el interruptor tiene que decir exactamente true", () => expect(compuertaDeEnvio({ ...llaves, MUESTRAS_CORREOS_EN_VIVO: "1" }).puede).toBe(false));
  it("sin remitente no envía", () => expect(compuertaDeEnvio({ ...llaves, MUESTRAS_EMAIL_FROM: "" }).puede).toBe(false));
});
