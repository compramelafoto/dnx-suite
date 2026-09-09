/**
 * OAuth de Google para integraciones. NO es el login.
 *
 * `@repo/auth` tiene funciones de Google, pero sirven para identificar a una persona:
 * `buildGoogleAuthorizationUrl` fija `access_type: "online"` y `exchangeGoogleAuthCode`
 * descarta el refresh token. Acá hace falta lo contrario — un permiso duradero para actuar
 * en nombre de la institución cuando nadie está mirando la pantalla.
 *
 * Nada de este archivo escribe el `code`, el `state` ni ningún token en los registros.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const INTEGRATIONS_GOOGLE_CALLBACK_PATH = "/api/integrations/google/callback";

/**
 * Los permisos de identidad, que van SIEMPRE además de los que pida la integración.
 *
 * Guardar una integración sin saber qué cuenta la otorgó es guardar algo que nadie puede
 * revisar después: la pantalla mostraría "conectado" sin decir a qué. Por eso el callback
 * le pregunta a Google por la cuenta, y esa consulta necesita su propio permiso: pidiendo
 * solo los de Calendar, el endpoint de identidad devuelve 401 y la conexión falla entera.
 *
 * Van acá y no en el registro de integraciones a propósito. En el registro habría que
 * repetirlos en cada integración nueva, y la que se los olvidara fallaría recién al
 * conectar de verdad, contra Google, que es donde nadie mira hasta que un usuario se queja.
 *
 * Ninguno de los dos es sensible para Google, así que no complican la verificación.
 */
const GOOGLE_IDENTITY_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export type GoogleIntegrationErrorCode =
  | "CONFIG"
  | "EXCHANGE_FAILED"
  | "NO_REFRESH_TOKEN"
  | "INVALID_GRANT";

export class GoogleIntegrationError extends Error {
  readonly code: GoogleIntegrationErrorCode;
  constructor(code: GoogleIntegrationErrorCode, message: string) {
    super(message);
    this.name = "GoogleIntegrationError";
    this.code = code;
  }
}

export type TokenResult = {
  accessToken: string;
  /** Solo viene en el primer consentimiento. En una renovación es null, y está bien. */
  refreshToken: string | null;
  expiresInSeconds: number;
  grantedScopes: string[];
};

/**
 * `access_type=offline` + `prompt=consent` es lo que hace que Google entregue un refresh
 * token. Sin las dos cosas, reconectar devuelve un permiso que sirve una hora y nada más.
 *
 * `include_granted_scopes=false` a propósito: cada integración pide exactamente sus
 * permisos. Acumularlos haría que el token de Calendar cargue también los de Classroom,
 * y un permiso que nadie pidió es un permiso que nadie controla.
 */
export function buildIntegrationAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: readonly string[];
  loginHint?: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: [...new Set([...GOOGLE_IDENTITY_SCOPES, ...params.scopes])].join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: params.state,
  });
  if (params.loginHint) q.set("login_hint", params.loginHint);
  return `${GOOGLE_AUTH_URL}?${q.toString()}`;
}

/** Una hora, que es lo que dura un access token de Google cuando no lo dice. */
const DEFAULT_EXPIRES_IN = 3600;

export function parseTokenResponse(payload: unknown): TokenResult {
  if (typeof payload !== "object" || payload === null) {
    throw new GoogleIntegrationError("EXCHANGE_FAILED", "Google devolvió una respuesta vacía.");
  }
  const row = payload as Record<string, unknown>;
  const accessToken = typeof row.access_token === "string" ? row.access_token : "";
  if (!accessToken) {
    throw new GoogleIntegrationError("EXCHANGE_FAILED", "Google no devolvió un token de acceso.");
  }
  return {
    accessToken,
    refreshToken: typeof row.refresh_token === "string" ? row.refresh_token : null,
    expiresInSeconds:
      typeof row.expires_in === "number" && row.expires_in > 0
        ? row.expires_in
        : DEFAULT_EXPIRES_IN,
    grantedScopes:
      typeof row.scope === "string" ? row.scope.split(" ").filter((s) => s.length > 0) : [],
  };
}

/** Google puede otorgar menos permisos de los pedidos. Hay que darse cuenta y avisar. */
export function hasAllScopes(granted: readonly string[], required: readonly string[]): boolean {
  const set = new Set(granted);
  return required.every((scope) => set.has(scope));
}

async function postToGoogleToken(body: URLSearchParams): Promise<TokenResult> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : "";
    // `invalid_grant` es "el permiso ya no vale": lo revocaron desde la cuenta de Google.
    // No es un error transitorio y no tiene sentido reintentarlo.
    if (error === "invalid_grant") {
      throw new GoogleIntegrationError(
        "INVALID_GRANT",
        "El permiso de Google ya no es válido. Hay que volver a conectar la cuenta.",
      );
    }
    throw new GoogleIntegrationError("EXCHANGE_FAILED", "Google rechazó el pedido de token.");
  }
  return parseTokenResponse(data);
}

export async function exchangeIntegrationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenResult> {
  const result = await postToGoogleToken(
    new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
  );
  if (!result.refreshToken) {
    // Pasa cuando la cuenta ya había dado el permiso y Google no lo vuelve a entregar.
    // Sin refresh token la integración serviría una hora: mejor fallar y pedir de nuevo.
    throw new GoogleIntegrationError(
      "NO_REFRESH_TOKEN",
      "Google no entregó un permiso duradero. Quitá el acceso desde tu cuenta de Google y volvé a conectar.",
    );
  }
  return result;
}

export async function refreshIntegrationAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResult> {
  return postToGoogleToken(
    new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "refresh_token",
    }),
  );
}

/** Le avisa a Google que el permiso ya no se usa. Un fallo acá no bloquea desconectar. */
export async function revokeIntegrationToken(refreshToken: string): Promise<void> {
  await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
    cache: "no-store",
  }).catch(() => undefined);
}

export async function fetchGoogleAccountEmail(
  accessToken: string,
): Promise<{ email: string; externalId: string }> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok || typeof data !== "object" || data === null) {
    throw new GoogleIntegrationError("EXCHANGE_FAILED", "No se pudo leer la cuenta de Google.");
  }
  const row = data as Record<string, unknown>;
  const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
  const externalId = typeof row.id === "string" ? row.id : "";
  if (!email || !externalId) {
    throw new GoogleIntegrationError("EXCHANGE_FAILED", "La cuenta de Google no expuso su email.");
  }
  return { email, externalId };
}
