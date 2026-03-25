const MP_AUTH_URL = "https://auth.mercadopago.com/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: string;
};

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} no está configurado`);
  }
  return value;
}

export function buildAuthorizeUrl({ state }: { state: string }): string {
  const clientId = getEnvOrThrow("MP_CLIENT_ID");
  const redirectUri = getEnvOrThrow("MP_REDIRECT_URI");

  const authUrl = new URL(MP_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  return authUrl.toString();
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const clientId = getEnvOrThrow("MP_CLIENT_ID");
  const clientSecret = getEnvOrThrow("MP_CLIENT_SECRET");
  const redirectUri = getEnvOrThrow("MP_REDIRECT_URI");

  const response = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as TokenResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data?.error || "Error intercambiando código de Mercado Pago");
  }
  return data;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = getEnvOrThrow("MP_CLIENT_ID");
  const clientSecret = getEnvOrThrow("MP_CLIENT_SECRET");

  const response = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as TokenResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data?.error || "Error refrescando token de Mercado Pago");
  }
  return data;
}
