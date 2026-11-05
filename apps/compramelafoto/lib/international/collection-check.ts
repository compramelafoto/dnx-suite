import { getCountry } from "./countries";
import type {
  IntlCollectionProvider,
  IntlCollectionSecret,
  IntlPaymentsEnvironment,
} from "./collection-secret";
import { collectionSecretLast4 } from "./collection-secret";

export type CollectionCheckResult =
  | { ok: true; accountId: string | null; accountLabel: string; accountCountryCode: string | null }
  | { ok: false; reason: "INVALID_CREDENTIALS" | "PROVIDER_UNAVAILABLE" };

type FailureReason = "INVALID_CREDENTIALS" | "PROVIDER_UNAVAILABLE";

const TIMEOUT_MS = 10_000;

/** Sitio de Mercado Pago (site_id) → código de país. */
export const MP_SITE_TO_COUNTRY: Record<string, string> = {
  MLA: "AR",
  MLB: "BR",
  MLM: "MX",
  MLC: "CL",
  MCO: "CO",
  MPE: "PE",
  MLU: "UY",
  MLV: "VE",
};

const fail = (reason: FailureReason): CollectionCheckResult => ({ ok: false, reason });

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const data = await res.json();
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function checkMercadoPago(accessToken: string, fetchImpl: typeof fetch): Promise<CollectionCheckResult> {
  const res = await fetchImpl("https://api.mercadopago.com/users/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403) return fail("INVALID_CREDENTIALS");
  if (res.status !== 200) return fail("PROVIDER_UNAVAILABLE");
  const body = await readJson(res);
  const siteId = text(body.site_id);
  const accountCountryCode =
    (siteId ? MP_SITE_TO_COUNTRY[siteId] : undefined) ?? text(body.country_id) ?? null;
  return {
    ok: true,
    accountId: body.id === undefined || body.id === null ? null : String(body.id),
    accountLabel: text(body.nickname) ?? text(body.email) ?? "Cuenta de Mercado Pago",
    accountCountryCode,
  };
}

async function checkPayPal(
  secret: Extract<IntlCollectionSecret, { provider: "PAYPAL_OWN" }>,
  environment: IntlPaymentsEnvironment,
  fetchImpl: typeof fetch,
): Promise<CollectionCheckResult> {
  const base = environment === "PROD" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const basic = Buffer.from(`${secret.clientId}:${secret.clientSecret}`).toString("base64");
  const res = await fetchImpl(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401) return fail("INVALID_CREDENTIALS");
  if (res.status !== 200) return fail("PROVIDER_UNAVAILABLE");
  const body = await readJson(res);
  return {
    ok: true,
    accountId: text(body.app_id),
    accountLabel: `App de PayPal ···${collectionSecretLast4(secret)}`,
    accountCountryCode: null,
  };
}

/** Comprueba las credenciales contra el proveedor. Nunca lanza ni expone el secreto. */
export async function checkCollectionSecret(
  secret: IntlCollectionSecret,
  environment: IntlPaymentsEnvironment,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<CollectionCheckResult> {
  try {
    return secret.provider === "MERCADOPAGO_OWN"
      ? await checkMercadoPago(secret.accessToken, fetchImpl)
      : await checkPayPal(secret, environment, fetchImpl);
  } catch {
    return fail("PROVIDER_UNAVAILABLE");
  }
}

/** Aviso si la cuenta de Mercado Pago es de otro país que el del fotógrafo; null si coincide o se desconoce. */
export function countryMismatchMessage(
  userCountryCode: string,
  accountCountryCode: string | null,
): string | null {
  if (!accountCountryCode || accountCountryCode === userCountryCode) return null;
  const accountName = getCountry(accountCountryCode)?.name ?? accountCountryCode;
  const userName = getCountry(userCountryCode)?.name ?? userCountryCode;
  return `Esta cuenta de Mercado Pago es de ${accountName} y tu país es ${userName}. Conectá la cuenta del país donde vendés.`;
}

export function checkFailureMessage(reason: FailureReason, provider: IntlCollectionProvider): string {
  if (reason === "PROVIDER_UNAVAILABLE") {
    return "No pudimos comprobar la conexión ahora. Probá de nuevo en unos minutos.";
  }
  return provider === "MERCADOPAGO_OWN"
    ? "Mercado Pago rechazó esas credenciales. Revisá que sea el Access Token de producción de tu aplicación."
    : "PayPal rechazó esas credenciales. Revisá el Client ID y el Secret de tu app Live.";
}
