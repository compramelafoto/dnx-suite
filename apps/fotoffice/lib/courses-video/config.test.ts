import { describe, expect, it } from "vitest";
import { readStreamConfig } from "./config";

describe("configuración del proveedor de video", () => {
  it("dice exactamente qué falta, sin lanzar", () => {
    // Mismo criterio que lib/payments/connect/config.ts: una variable ausente no puede
    // tumbar la pantalla, tiene que poder explicarse.
    expect(readStreamConfig({})).toEqual({
      ok: false,
      missing: [
        "STREAM_ACCOUNT_ID",
        "STREAM_API_TOKEN",
        "STREAM_SIGNING_KEY_ID",
        "STREAM_SIGNING_KEY_PEM",
      ],
    });
  });

  it("nombra sólo las que faltan", () => {
    const r = readStreamConfig({ STREAM_ACCOUNT_ID: "cuenta", STREAM_API_TOKEN: "token" });
    expect(r).toEqual({
      ok: false,
      missing: ["STREAM_SIGNING_KEY_ID", "STREAM_SIGNING_KEY_PEM"],
    });
  });

  it("una variable en blanco cuenta como ausente", () => {
    const r = readStreamConfig({
      STREAM_ACCOUNT_ID: "   ",
      STREAM_API_TOKEN: "token",
      STREAM_SIGNING_KEY_ID: "clave",
      STREAM_SIGNING_KEY_PEM: "pem",
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.missing).toEqual(["STREAM_ACCOUNT_ID"]);
  });

  it("con las cuatro cargadas queda configurada y sin espacios de más", () => {
    const r = readStreamConfig({
      STREAM_ACCOUNT_ID: " cuenta ",
      STREAM_API_TOKEN: "token",
      STREAM_SIGNING_KEY_ID: "clave",
      STREAM_SIGNING_KEY_PEM: "pem",
    });
    expect(r).toEqual({
      ok: true,
      config: {
        accountId: "cuenta",
        apiToken: "token",
        signingKeyId: "clave",
        signingKeyPem: "pem",
      },
    });
  });
});
