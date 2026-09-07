import { SocialPublisherError } from "../../types";

/** Se renueva cuando le quedan menos de estos días. */
export const TOKEN_REFRESH_THRESHOLD_DAYS = 10;
/** Meta rechaza renovar un token con menos de esta edad. */
export const TOKEN_MIN_AGE_HOURS = 24;

export type TokenRefreshDecision =
  | { action: "REFRESH" }
  | { action: "SKIP"; reason: "TOO_YOUNG" | "NOT_DUE" | "EXPIRED" };

export function decideTokenRefresh(input: {
  createdAt: Date;
  expiresAt: Date | null;
  now: Date;
}): TokenRefreshDecision {
  const { createdAt, expiresAt, now } = input;

  // Un token vencido no se renueva: hay que volver a conectar la cuenta a mano.
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    return { action: "SKIP", reason: "EXPIRED" };
  }

  const edadHoras = (now.getTime() - createdAt.getTime()) / 3600_000;
  if (edadHoras < TOKEN_MIN_AGE_HOURS) {
    return { action: "SKIP", reason: "TOO_YOUNG" };
  }

  // Sin fecha de vencimiento no se puede calcular el margen. Se renueva: el costo de
  // renovar de más es una llamada; el de renovar de menos es quedarse sin publicar.
  if (!expiresAt) return { action: "REFRESH" };

  const diasRestantes = (expiresAt.getTime() - now.getTime()) / 86400_000;
  return diasRestantes < TOKEN_REFRESH_THRESHOLD_DAYS
    ? { action: "REFRESH" }
    : { action: "SKIP", reason: "NOT_DUE" };
}

export async function refreshInstagramToken(
  accessToken: string,
  deps: { fetchImpl?: typeof fetch; now?: () => Date } = {},
): Promise<{ accessToken: string; expiresAt: Date }> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  const res = await fetchImpl(url.toString());
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!res.ok || json.error || !json.access_token) {
    throw new SocialPublisherError(
      "INSTAGRAM_TOKEN_REFRESH_FAILED",
      String(json.error?.message ?? `HTTP ${res.status}`).slice(0, 200),
      res.status === 429 || res.status >= 500,
    );
  }

  return {
    accessToken: json.access_token,
    expiresAt: new Date(now().getTime() + (json.expires_in ?? 5184000) * 1000),
  };
}
