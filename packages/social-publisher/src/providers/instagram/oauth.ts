import { SocialPublisherError } from "../../types";

/** Permisos mínimos para publicar. Ver spec §7. */
export const INSTAGRAM_PUBLISH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;

export type InstagramOAuthConfig = {
  appId: string;
  appSecret: string;
  /** Debe coincidir carácter por carácter con el usado al pedir el código. */
  redirectUri: string;
  scopes?: readonly string[];
  apiVersion?: string;
};

export type InstagramConnectedAccount = {
  externalAccountId: string;
  username: string | null;
  accessToken: string;
  expiresAt: Date;
  scopes: string[];
};

type Deps = { fetchImpl?: typeof fetch; now?: () => Date };

export function buildInstagramAuthorizeUrl(
  config: InstagramOAuthConfig,
  state: string,
): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    (config.scopes ?? INSTAGRAM_PUBLISH_SCOPES).join(","),
  );
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Lee la respuesta y falla con un mensaje acotado.
 *
 * Nunca incluye el cuerpo de la request: ahí viaja `client_secret`, y estos errores
 * terminan en logs.
 */
async function leerJson<T>(res: Response, contexto: string): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string };
    error_message?: string;
  };
  if (!res.ok || json.error || json.error_message) {
    const msg = json.error?.message ?? json.error_message ?? `HTTP ${res.status}`;
    throw new SocialPublisherError(
      "INSTAGRAM_OAUTH_ERROR",
      `${contexto}: ${String(msg).slice(0, 200)}`,
      res.status === 429 || res.status >= 500,
    );
  }
  return json;
}

export async function exchangeInstagramCode(
  config: InstagramOAuthConfig,
  code: string,
  deps: Deps = {},
): Promise<InstagramConnectedAccount> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());
  const version = config.apiVersion ?? "v21.0";

  // 1. Código → token corto. Va por POST y en formulario: Meta rechaza JSON acá.
  const cuerpo = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code,
  });
  const corto = await leerJson<{ access_token: string; user_id: string | number }>(
    await fetchImpl("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: cuerpo.toString(),
    }),
    "canje del código",
  );

  // 2. Token corto → token largo (60 días).
  const urlLargo = new URL("https://graph.instagram.com/access_token");
  urlLargo.searchParams.set("grant_type", "ig_exchange_token");
  urlLargo.searchParams.set("client_secret", config.appSecret);
  urlLargo.searchParams.set("access_token", corto.access_token);
  const largo = await leerJson<{ access_token: string; expires_in: number }>(
    await fetchImpl(urlLargo.toString()),
    "canje a token largo",
  );

  // 3. Quién es la cuenta.
  const urlYo = new URL(`https://graph.instagram.com/${version}/me`);
  urlYo.searchParams.set("fields", "user_id,username");
  urlYo.searchParams.set("access_token", largo.access_token);
  const yo = await leerJson<{ user_id?: string; username?: string }>(
    await fetchImpl(urlYo.toString()),
    "identificación de la cuenta",
  );

  return {
    externalAccountId: String(yo.user_id ?? corto.user_id),
    username: yo.username ?? null,
    accessToken: largo.access_token,
    expiresAt: new Date(now().getTime() + largo.expires_in * 1000),
    scopes: [...(config.scopes ?? INSTAGRAM_PUBLISH_SCOPES)],
  };
}
