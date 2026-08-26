import type { MpTokenExchangeResult, MpUserLookupResult } from "./types.js";

const MP_AUTH_URL = "https://auth.mercadopago.com/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const MP_USERS_ME = "https://api.mercadopago.com/users/me";

export type MercadoPagoOAuthHttpClient = {
  exchangeAuthorizationCode(input: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string | null;
  }): Promise<MpTokenExchangeResult>;
  /**
   * Canjea un refresh token por uno nuevo. Opcional a propósito: las implementaciones de
   * prueba que ya existen no lo tienen, y volverlo obligatorio las rompería sin motivo.
   *
   * Devuelve la misma forma que el canje inicial, incluido un refresh token nuevo:
   * MercadoPago rota el refresh token en cada uso, así que quedarse con el viejo deja la
   * cuenta sin poder renovar la próxima vez.
   */
  refreshAccessToken?(input: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<MpTokenExchangeResult>;
  fetchAuthorizedUser(accessToken: string): Promise<MpUserLookupResult>;
};

/**
 * Thin façade for exchange — tokens never leave the HTTP client toward UI.
 * Prefer wiring via ClickatonOwnerOAuthService.completeCallback (vault + account).
 */
export type MercadoPagoOAuthExchangeInput = {
  authorizationCode: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  codeVerifier?: string | null;
  expectedEnvironment: "TEST" | "PROD";
};

export type MercadoPagoOAuthExchangeSanitizedResult = {
  providerAccountId: string;
  scopes: string[];
  mode: "TEST" | "PROD";
  expiresInSeconds: number | null;
  connectionStatus: "EXCHANGED";
};

export const MercadoPagoOAuthService = {
  async exchangeAuthorizationCode(
    client: MercadoPagoOAuthHttpClient,
    input: MercadoPagoOAuthExchangeInput,
  ): Promise<MercadoPagoOAuthExchangeSanitizedResult> {
    const tokens = await client.exchangeAuthorizationCode({
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      code: input.authorizationCode,
      redirectUri: input.redirectUri,
      codeVerifier: input.codeVerifier,
    });
    // Intentionally drop access/refresh tokens from the returned object.
    return {
      providerAccountId: tokens.providerUserId,
      scopes: tokens.scope ? tokens.scope.split(/[,\s]+/).filter(Boolean) : [],
      mode: input.expectedEnvironment,
      expiresInSeconds: tokens.expiresIn,
      connectionStatus: "EXCHANGED",
    };
  },
};

/** In-memory fake for tests — never hits Mercado Pago. */
export function createFakeMercadoPagoOAuthHttpClient(opts?: {
  providerUserId?: string;
  failExchange?: boolean;
}): MercadoPagoOAuthHttpClient {
  const providerUserId = opts?.providerUserId ?? "99887766";
  return {
    async exchangeAuthorizationCode() {
      if (opts?.failExchange) {
        throw new Error("mp_token_exchange_failed");
      }
      return {
        accessToken: "APP_USR-fake-access-token",
        refreshToken: "TG-fake-refresh",
        expiresIn: 3600,
        providerUserId,
        scope: "offline_access read",
      };
    },
    async fetchAuthorizedUser() {
      return {
        providerUserId,
        nicknameMasked: "f***e",
        emailMasked: "t***@t***",
      };
    },
  };
}

export function buildMercadoPagoAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string | null;
}): string {
  // Orden alineado a la doc MP Connect + CLF productivo.
  // redirect_uri debe coincidir byte-a-byte con "URLs de redireccionamiento" en Developers.
  const url = new URL(MP_AUTH_URL);
  url.searchParams.set("client_id", input.clientId.trim());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", input.state);
  url.searchParams.set("redirect_uri", input.redirectUri.trim());
  if (input.codeChallenge) {
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

function maskNick(nickname: unknown): string | null {
  if (typeof nickname !== "string" || !nickname.trim()) return null;
  const n = nickname.trim();
  if (n.length <= 2) return "**";
  return `${n.slice(0, 1)}***${n.slice(-1)}`;
}

function maskEmail(email: unknown): string | null {
  if (typeof email !== "string" || !email.includes("@")) return null;
  const [u, d] = email.split("@");
  if (!u || !d) return null;
  return `${u.slice(0, 1)}***@${d[0] ?? "*"}***`;
}

export function createLiveMercadoPagoOAuthHttpClient(
  fetchImpl: typeof fetch = fetch,
): MercadoPagoOAuthHttpClient {
  return {
    async exchangeAuthorizationCode(input) {
      const body: Record<string, string> = {
        grant_type: "authorization_code",
        client_id: input.clientId,
        client_secret: input.clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri,
      };
      if (input.codeVerifier) {
        body.code_verifier = input.codeVerifier;
      }
      const response = await fetchImpl(MP_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        user_id?: number | string;
        scope?: string;
        error?: string;
        message?: string;
      };
      if (!response.ok || !data.access_token) {
        throw new Error(data.error || data.message || "mp_token_exchange_failed");
      }
      const providerUserId =
        data.user_id !== undefined && data.user_id !== null
          ? String(data.user_id)
          : "";
      if (!providerUserId) {
        throw new Error("mp_token_missing_user_id");
      }
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresIn: typeof data.expires_in === "number" ? data.expires_in : null,
        providerUserId,
        scope: data.scope ?? null,
      };
    },
    async refreshAccessToken(input) {
      const response = await fetchImpl(MP_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: input.clientId,
          client_secret: input.clientSecret,
          refresh_token: input.refreshToken,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        user_id?: number | string;
        scope?: string;
        error?: string;
        message?: string;
      };
      if (!response.ok || !data.access_token) {
        throw new Error(data.error || data.message || "mp_token_refresh_failed");
      }
      const providerUserId =
        data.user_id !== undefined && data.user_id !== null ? String(data.user_id) : "";
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresIn: typeof data.expires_in === "number" ? data.expires_in : null,
        providerUserId,
        scope: data.scope ?? null,
      };
    },
    async fetchAuthorizedUser(accessToken) {
      const response = await fetchImpl(MP_USERS_ME, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      const data = (await response.json().catch(() => ({}))) as {
        id?: number | string;
        nickname?: string;
        email?: string;
        message?: string;
      };
      if (!response.ok || data.id === undefined || data.id === null) {
        throw new Error(data.message || "mp_users_me_failed");
      }
      return {
        providerUserId: String(data.id),
        nicknameMasked: maskNick(data.nickname),
        emailMasked: maskEmail(data.email),
      };
    },
  };
}

/**
 * Alias históricos.
 *
 * Este cliente nunca tuvo nada de Clickatón: recibe `clientId`, `redirectUri`, `state` y
 * `codeChallenge` por parámetro y no lee ninguna configuración propia. Pero su nombre lo
 * sugería, y eso impedía que otro producto lo usara sin que el código mintiera.
 *
 * Se conservan los nombres viejos para no tocar Clickatón, que hoy mueve dinero real.
 *
 * @deprecated Usar las versiones sin `Clickaton` en el nombre.
 */
export type ClickatonMpOAuthHttpClient = MercadoPagoOAuthHttpClient;
/** @deprecated Usar `buildMercadoPagoAuthorizeUrl`. */
export const buildClickatonMpAuthorizeUrl = buildMercadoPagoAuthorizeUrl;
/** @deprecated Usar `createFakeMercadoPagoOAuthHttpClient`. */
export const createFakeClickatonMpOAuthHttpClient = createFakeMercadoPagoOAuthHttpClient;
/** @deprecated Usar `createLiveMercadoPagoOAuthHttpClient`. */
export const createLiveClickatonMpOAuthHttpClient = createLiveMercadoPagoOAuthHttpClient;
