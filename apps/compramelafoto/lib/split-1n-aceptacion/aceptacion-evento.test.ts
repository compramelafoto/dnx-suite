import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAceptacionEventoConfig } from "./config";
import { decidirAceptacion } from "./regla";

const SPLIT_LISTO = {
  DNX_CLF_SPLIT_1N_PILOTO_ENABLED: "true",
  DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true",
  DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED: "true",
  DNX_MP_PLATFORM_ACCESS_TOKEN: "APP_USR-x",
  DNX_CLF_SPLIT_1N_PILOTO_OWNER_USER_ID: "97484805",
};

describe("aviso del cobro dividido para participantes de un evento", () => {
  it("se enciende sin «todos los álbumes» ni fecha límite", () => {
    assert.deepEqual(resolveAceptacionEventoConfig(SPLIT_LISTO), { enabled: true, limite: null });
  });

  it("si falta una pieza del cobro dividido, queda apagado", () => {
    for (const falta of Object.keys(SPLIT_LISTO)) {
      const env = { ...SPLIT_LISTO, [falta]: "" };
      assert.equal(resolveAceptacionEventoConfig(env).enabled, false, falta);
    }
  });

  it("el cartel aparece, sin fecha y nunca obligatorio", () => {
    const r = decidirAceptacion({
      config: { enabled: true, limite: null },
      ahora: new Date("2030-01-01T00:00:00Z"),
      rol: "PHOTOGRAPHER",
      terminosAceptados: false,
      estadoMp: "SIN_PEDIR",
      mpRespondio: true,
    });
    assert.deepEqual(r, { mostrar: true, obligatorio: false, limite: null, faltaTerminos: true, faltaMercadoPago: true });
  });

  it("con las dos cosas hechas, no aparece", () => {
    const r = decidirAceptacion({
      config: { enabled: true, limite: null },
      ahora: new Date(),
      rol: "ORGANIZER",
      terminosAceptados: true,
      estadoMp: "ACTIVE",
      mpRespondio: true,
    });
    assert.deepEqual(r, { mostrar: false });
  });
});
