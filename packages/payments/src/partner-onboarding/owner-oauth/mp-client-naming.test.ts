import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClickatonMpAuthorizeUrl,
  buildMercadoPagoAuthorizeUrl,
  createFakeClickatonMpOAuthHttpClient,
  createFakeMercadoPagoOAuthHttpClient,
  createLiveClickatonMpOAuthHttpClient,
  createLiveMercadoPagoOAuthHttpClient,
} from "./mp-client.js";

describe("nombres neutrales del cliente OAuth de MercadoPago", () => {
  it("buildMercadoPagoAuthorizeUrl arma la URL de autorización", () => {
    const url = buildMercadoPagoAuthorizeUrl({
      clientId: "cid-1",
      redirectUri: "https://fotoffice.com/cb",
      state: "st-1",
      codeChallenge: "ch-1",
    });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("client_id"), "cid-1");
    assert.equal(parsed.searchParams.get("redirect_uri"), "https://fotoffice.com/cb");
    assert.equal(parsed.searchParams.get("state"), "st-1");
    assert.equal(parsed.searchParams.get("code_challenge"), "ch-1");
    assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
    assert.equal(parsed.searchParams.get("response_type"), "code");
  });

  it("sin codeChallenge no manda los parámetros de PKCE", () => {
    const url = buildMercadoPagoAuthorizeUrl({
      clientId: "cid-1",
      redirectUri: "https://fotoffice.com/cb",
      state: "st-1",
    });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("code_challenge"), null);
    assert.equal(parsed.searchParams.get("code_challenge_method"), null);
  });

  /**
   * Los alias existen para que Clickatón no tenga que cambiar ni una línea. Si alguien los
   * borra, estos tests lo avisan antes de que rompa el build de otra app.
   */
  it("los alias de Clickatón son exactamente las mismas funciones", () => {
    assert.equal(buildClickatonMpAuthorizeUrl, buildMercadoPagoAuthorizeUrl);
    assert.equal(createFakeClickatonMpOAuthHttpClient, createFakeMercadoPagoOAuthHttpClient);
    assert.equal(createLiveClickatonMpOAuthHttpClient, createLiveMercadoPagoOAuthHttpClient);
  });

  it("el cliente falso sigue funcionando por cualquiera de los dos nombres", async () => {
    const viaNuevo = createFakeMercadoPagoOAuthHttpClient();
    const viaAlias = createFakeClickatonMpOAuthHttpClient();
    assert.equal(typeof viaNuevo.exchangeAuthorizationCode, "function");
    assert.equal(typeof viaAlias.exchangeAuthorizationCode, "function");
  });
});
