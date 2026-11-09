import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COOKIE_VENDEDOR,
  EDAD_COOKIE_VENDEDOR_S,
  guardarAtribucionVendedor,
  leerTokenVendedor,
  tokenVendedorValido,
} from "./atribucion";

const TOKEN = "abcDEF1234567890_-xyz";
const reqCon = (cookie?: string) =>
  new Request("https://www.compramelafoto.com/", cookie ? { headers: { cookie } } : undefined);

describe("atribución del Vendedor", () => {
  it("constantes", () => {
    assert.equal(COOKIE_VENDEDOR, "clf_dnxv");
    assert.equal(EDAD_COOKIE_VENDEDOR_S, 5184000);
  });

  it("tokenVendedorValido", () => {
    assert.equal(tokenVendedorValido(`  ${TOKEN} `), TOKEN);
    assert.equal(tokenVendedorValido("corto"), null);
    assert.equal(tokenVendedorValido("<script>alert(1)</script>"), null);
    assert.equal(tokenVendedorValido(undefined), null);
    assert.equal(tokenVendedorValido("a".repeat(65)), null);
  });

  it("leerTokenVendedor lee la cabecera cookie", () => {
    assert.equal(leerTokenVendedor(reqCon(`x=1; clf_dnxv=${TOKEN}; y=2`)), TOKEN);
    assert.equal(leerTokenVendedor(reqCon("x=1")), null);
    assert.equal(leerTokenVendedor(reqCon()), null);
  });

  it("con la cookie guarda userId, token y rol", async () => {
    const llamadas: unknown[] = [];
    const ok = await guardarAtribucionVendedor(
      { req: reqCon(`clf_dnxv=${TOKEN}`), userId: 7, rol: "ORGANIZER" },
      { crear: async (d) => void llamadas.push(d) }
    );
    assert.equal(ok, true);
    assert.deepEqual(llamadas, [{ userId: 7, token: TOKEN, rol: "ORGANIZER" }]);
  });

  it("sin cookie no escribe", async () => {
    let n = 0;
    const ok = await guardarAtribucionVendedor(
      { req: reqCon(), userId: 7, rol: "ORGANIZER" },
      { crear: async () => void n++ }
    );
    assert.equal(ok, false);
    assert.equal(n, 0);
  });

  it("un usuario repetido no lanza y devuelve false", async () => {
    const ok = await guardarAtribucionVendedor(
      { req: reqCon(`clf_dnxv=${TOKEN}`), userId: 7, rol: "PHOTOGRAPHER" },
      { crear: async () => { throw { code: "P2002" }; } }
    );
    assert.equal(ok, false);
  });

  it("cualquier otro error tampoco lanza", async () => {
    const ok = await guardarAtribucionVendedor(
      { req: reqCon(`clf_dnxv=${TOKEN}`), userId: 7, rol: "PHOTOGRAPHER" },
      { crear: async () => { throw new Error("boom"); } }
    );
    assert.equal(ok, false);
  });

  it("no crea ReferralAttribution", () => {
    const src = readFileSync(join(__dirname, "atribucion.ts"), "utf8");
    assert.ok(!/lib\/referral|referral-cookie|ReferralAttribution/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
  });
});
