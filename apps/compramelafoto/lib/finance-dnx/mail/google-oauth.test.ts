import assert from "node:assert/strict";
import test from "node:test";

import {
  GMAIL_SCOPES,
  OAuthError,
  buildConsentUrl,
  exchangeCode,
  refreshAccessToken,
  signState,
  verifyState,
} from "./google-oauth";

const SECRET = "secreto-de-prueba";
const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);

function idToken(email: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "RS256" })}.${b64({ email, email_verified: true })}.firma`;
}

function fakeFetch(status: number, body: object): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

test("el state firmado vale durante 10 minutos y después no", () => {
  const s = signState(T0, SECRET);
  assert.equal(verifyState(s, T0 + 9 * 60_000, SECRET), true);
  assert.equal(verifyState(s, T0 + 11 * 60_000, SECRET), false);
});

test("un state alterado o con otro secreto no vale", () => {
  const s = signState(T0, SECRET);
  const [issued, nonce, sig] = s.split(".");
  assert.equal(verifyState(`${issued}.${nonce}x.${sig}`, T0, SECRET), false);
  assert.equal(verifyState(`${Number(issued) + 1}.${nonce}.${sig}`, T0 + 1, SECRET), false);
  assert.equal(verifyState(s, T0, "otro"), false);
  assert.equal(verifyState("basura", T0, SECRET), false);
});

test("la URL pide sólo lectura, acceso offline y consentimiento", () => {
  const url = new URL(buildConsentUrl({ clientId: "cid", redirectUri: "https://x/cb", state: "st" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("scope"), GMAIL_SCOPES);
  assert.equal(GMAIL_SCOPES.includes("gmail.readonly"), true);
  assert.equal(GMAIL_SCOPES.includes("gmail.modify"), false);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "st");
});

test("el canje devuelve token y email de una cuenta permitida", async () => {
  const r = await exchangeCode({
    code: "c", clientId: "cid", clientSecret: "cs", redirectUri: "https://x/cb",
    fetchImpl: fakeFetch(200, { refresh_token: "1//rt", id_token: idToken("DNXfotografia@gmail.com") }),
  });
  assert.deepEqual(r, { refreshToken: "1//rt", email: "dnxfotografia@gmail.com" });
});

test("una cuenta que no es de las tres se rechaza", async () => {
  await assert.rejects(
    exchangeCode({
      code: "c", clientId: "cid", clientSecret: "cs", redirectUri: "https://x/cb",
      fetchImpl: fakeFetch(200, { refresh_token: "1//rt", id_token: idToken("intruso@gmail.com") }),
    }),
    (e: unknown) => e instanceof OAuthError && /intruso@gmail.com/.test(e.message),
  );
});

test("sin refresh token se rechaza con un mensaje que explica qué hacer", async () => {
  await assert.rejects(
    exchangeCode({
      code: "c", clientId: "cid", clientSecret: "cs", redirectUri: "https://x/cb",
      fetchImpl: fakeFetch(200, { id_token: idToken("dnxfotografia@gmail.com") }),
    }),
    /permiso/i,
  );
});

test("un permiso revocado se marca como revocado", async () => {
  await assert.rejects(
    refreshAccessToken({
      refreshToken: "1//rt", clientId: "cid", clientSecret: "cs",
      fetchImpl: fakeFetch(400, { error: "invalid_grant" }),
    }),
    (e: unknown) => e instanceof OAuthError && e.revoked === true,
  );
});

test("la renovación devuelve el access token", async () => {
  const t = await refreshAccessToken({
    refreshToken: "1//rt", clientId: "cid", clientSecret: "cs",
    fetchImpl: fakeFetch(200, { access_token: "ya29.x", expires_in: 3599 }),
  });
  assert.equal(t, "ya29.x");
});
