import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CIERRE_FLAG,
  MONTO_MAXIMO_CENTAVOS,
  MONTO_POR_OMISION_CENTAVOS,
  pagadorTambienRecibe,
  resolveCierreConfig,
  REPARTO_BPS,
} from "./config";

/** Entorno mínimo válido. Cada test rompe una sola cosa a la vez. */
function envValido(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    [CIERRE_FLAG]: "true",
    MP_ACCESS_TOKEN: "APP_USR-token-productivo",
    NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: "APP_USR-public-key",
    DNX_CLF_SPLIT_1N_CIERRE_OWNER_USER_ID: "123456789",
    DNX_CLF_SPLIT_1N_CIERRE_RECEIVER_A: "receiver-aaa",
    DNX_CLF_SPLIT_1N_CIERRE_RECEIVER_B: "receiver-bbb",
    ...extra,
  } as NodeJS.ProcessEnv;
}

describe("frenos de la orden de cierre Split 1:N", () => {
  it("acepta el entorno válido y usa el monto por omisión", () => {
    const r = resolveCierreConfig(envValido());
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.config.totalMinor, BigInt(MONTO_POR_OMISION_CENTAVOS));
      assert.equal(r.config.tokenSource, "MP_ACCESS_TOKEN");
      assert.equal(r.config.payerEmailOverride, null);
    }
  });

  it("bloquea con la bandera apagada", () => {
    const r = resolveCierreConfig(envValido({ [CIERRE_FLAG]: undefined }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "FLAG_APAGADA");
  });

  it("bloquea en el sitio desplegado aunque todo lo demás esté bien", () => {
    const r = resolveCierreConfig(envValido({ VERCEL_ENV: "production" }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "ENTORNO_DESPLEGADO");
  });

  it("rechaza un token de prueba: esto es dinero real", () => {
    const r = resolveCierreConfig(
      envValido({ MP_ACCESS_TOKEN: "TEST-token-de-prueba" }),
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "TOKEN_DE_PRUEBA");
  });

  it("bloquea sin token", () => {
    const r = resolveCierreConfig(envValido({ MP_ACCESS_TOKEN: undefined }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "SIN_TOKEN");
  });

  it("bloquea sin owner", () => {
    const r = resolveCierreConfig(
      envValido({ DNX_CLF_SPLIT_1N_CIERRE_OWNER_USER_ID: undefined }),
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "SIN_OWNER");
  });

  it("bloquea si falta uno de los dos partners", () => {
    const r = resolveCierreConfig(
      envValido({ DNX_CLF_SPLIT_1N_CIERRE_RECEIVER_B: undefined }),
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "SIN_RECEPTORES");
  });

  it("bloquea si los dos partners son el mismo: MP pide 3 receptores distintos", () => {
    const r = resolveCierreConfig(
      envValido({ DNX_CLF_SPLIT_1N_CIERRE_RECEIVER_B: "receiver-aaa" }),
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "RECEPTORES_REPETIDOS");
  });

  it("frena un monto por encima del tope de seguridad", () => {
    const r = resolveCierreConfig(
      envValido({
        DNX_CLF_SPLIT_1N_CIERRE_MONTO_CENTAVOS: String(MONTO_MAXIMO_CENTAVOS + 1),
      }),
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "MONTO_SOBRE_TOPE");
  });

  it("frena un monto con coma, negativo o no numérico", () => {
    for (const malo of ["1500.50", "-100", "mil", "0"]) {
      const r = resolveCierreConfig(
        envValido({ DNX_CLF_SPLIT_1N_CIERRE_MONTO_CENTAVOS: malo }),
      );
      assert.equal(r.ok, false, `debería rechazar ${malo}`);
      if (!r.ok) assert.equal(r.error.code, "MONTO_INVALIDO");
    }
  });

  it("acepta un monto válido dentro del tope", () => {
    const r = resolveCierreConfig(
      envValido({ DNX_CLF_SPLIT_1N_CIERRE_MONTO_CENTAVOS: "200000" }),
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.config.totalMinor, BigInt(200_000));
  });

  it("toma el correo del pagador si se declara", () => {
    const r = resolveCierreConfig(
      envValido({ DNX_CLF_SPLIT_1N_CIERRE_PAYER_EMAIL: "Alguien@Ejemplo.COM" }),
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.config.payerEmailOverride, "alguien@ejemplo.com");
  });
});

describe("reparto del cierre", () => {
  it("suma 10.000 puntos básicos, o Mercado Pago rechaza la orden", () => {
    const suma = REPARTO_BPS.owner + REPARTO_BPS.fotografo + REPARTO_BPS.referidor;
    assert.equal(suma, 10_000);
  });

  it("le da la mayor parte al fotógrafo que vende", () => {
    assert.ok(REPARTO_BPS.fotografo > REPARTO_BPS.owner);
    assert.ok(REPARTO_BPS.fotografo > REPARTO_BPS.referidor);
  });

  it("la porción más chica no queda en cifras ridículas con el monto por omisión", () => {
    const menor = Math.min(
      REPARTO_BPS.owner,
      REPARTO_BPS.fotografo,
      REPARTO_BPS.referidor,
    );
    const centavos = Math.floor((MONTO_POR_OMISION_CENTAVOS * menor) / 10_000);
    // $100 es el piso por debajo del cual los mínimos del medio de pago empiezan a pesar.
    assert.ok(centavos >= 10_000, `la parte más chica queda en ${centavos} centavos`);
  });
});

describe("el pagador tiene que ser un tercero", () => {
  const receptores = ["fotografo@ejemplo.com", "referidor@ejemplo.com"];

  it("detecta que el pagador es uno de los receptores", () => {
    assert.equal(pagadorTambienRecibe("fotografo@ejemplo.com", receptores), true);
    assert.equal(pagadorTambienRecibe("referidor@ejemplo.com", receptores), true);
  });

  it("no se deja engañar por mayúsculas ni espacios", () => {
    assert.equal(pagadorTambienRecibe("  FotoGrafo@Ejemplo.COM  ", receptores), true);
    assert.equal(pagadorTambienRecibe("fotografo@ejemplo.com", ["  FOTOGRAFO@EJEMPLO.COM "]), true);
  });

  it("acepta un tercero", () => {
    assert.equal(pagadorTambienRecibe("otra.persona@ejemplo.com", receptores), false);
  });

  it("con pagador vacío no bloquea: ese caso lo cubre otro freno", () => {
    assert.equal(pagadorTambienRecibe("", receptores), false);
    assert.equal(pagadorTambienRecibe("   ", receptores), false);
  });

  it("no confunde un correo vacío de un receptor con un pagador vacío", () => {
    assert.equal(pagadorTambienRecibe("alguien@ejemplo.com", ["", "  "]), false);
  });
});
