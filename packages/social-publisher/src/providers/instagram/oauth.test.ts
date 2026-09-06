import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildInstagramAuthorizeUrl,
  exchangeInstagramCode,
  type InstagramOAuthConfig,
} from "./oauth";

const config: InstagramOAuthConfig = {
  appId: "111",
  appSecret: "secreto",
  redirectUri: "https://clf.test/api/social/instagram/callback",
};

test("la URL de autorización lleva los permisos y el state", () => {
  const url = new URL(buildInstagramAuthorizeUrl(config, "estado-123"));
  assert.equal(url.host, "www.instagram.com");
  assert.equal(url.pathname, "/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "111");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "estado-123");
  assert.equal(
    url.searchParams.get("scope"),
    "instagram_business_basic,instagram_business_content_publish",
  );
  assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
});

test("el canje encadena las tres llamadas y devuelve el token largo", async () => {
  const llamadas: string[] = [];
  const fetchImpl = (async (input: string | URL) => {
    const url = String(input);
    llamadas.push(url);
    if (url.startsWith("https://api.instagram.com/oauth/access_token")) {
      return new Response(
        JSON.stringify({ access_token: "corto", user_id: "17841400000000000" }),
        { status: 200 },
      );
    }
    if (url.startsWith("https://graph.instagram.com/access_token")) {
      return new Response(
        JSON.stringify({ access_token: "largo", expires_in: 5184000 }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({ user_id: "17841400000000000", username: "compramelafoto" }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const cuenta = await exchangeInstagramCode(config, "codigo-abc", {
    fetchImpl,
    now: () => new Date("2026-09-05T12:00:00Z"),
  });

  assert.equal(cuenta.accessToken, "largo");
  assert.equal(cuenta.externalAccountId, "17841400000000000");
  assert.equal(cuenta.username, "compramelafoto");
  assert.equal(cuenta.expiresAt.toISOString(), "2026-11-04T12:00:00.000Z");
  assert.equal(llamadas.length, 3);
});

test("un error de Meta no filtra el secreto de la app", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error_message: "código vencido" }), {
      status: 400,
    })) as unknown as typeof fetch;

  await assert.rejects(
    () => exchangeInstagramCode(config, "viejo", { fetchImpl }),
    (e: Error) => !e.message.includes("secreto"),
  );
});
