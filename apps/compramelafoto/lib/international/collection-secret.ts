/** Medios de cobro con cuenta propia del fotógrafo (cobro internacional). */
export type IntlCollectionProvider = "MERCADOPAGO_OWN" | "PAYPAL_OWN";

/** Entorno de pagos: TEST acepta credenciales de prueba, PROD solo reales. */
export type IntlPaymentsEnvironment = "TEST" | "PROD";

export type IntlCollectionSecret =
  | { provider: "MERCADOPAGO_OWN"; accessToken: string }
  | { provider: "PAYPAL_OWN"; clientId: string; clientSecret: string };

const PAYPAL_MIN_LENGTH = 20;

function trimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Recorta espacios y saltos de línea. Devuelve null si falta algo o el medio es desconocido. */
export function cleanCollectionSecret(raw: unknown): IntlCollectionSecret | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  if (body.provider === "MERCADOPAGO_OWN") {
    const accessToken = trimmedString(body.accessToken);
    return accessToken ? { provider: "MERCADOPAGO_OWN", accessToken } : null;
  }
  if (body.provider === "PAYPAL_OWN") {
    const clientId = trimmedString(body.clientId);
    const clientSecret = trimmedString(body.clientSecret);
    return clientId && clientSecret ? { provider: "PAYPAL_OWN", clientId, clientSecret } : null;
  }
  return null;
}

/** Devuelve el mensaje de error para mostrar al fotógrafo, o null si la forma es válida. */
export function validateCollectionSecret(
  s: IntlCollectionSecret,
  env: IntlPaymentsEnvironment,
): string | null {
  if (s.provider === "PAYPAL_OWN") {
    if (s.clientId.length < PAYPAL_MIN_LENGTH || s.clientSecret.length < PAYPAL_MIN_LENGTH) {
      return "El Client ID y el Secret de PayPal parecen incompletos. Copialos de nuevo desde tu app Live.";
    }
    return null;
  }
  if (env === "TEST") return null;
  if (s.accessToken.startsWith("TEST-")) {
    return "Ese es un token de prueba. Pegá el Access Token de producción, que empieza con APP_USR-.";
  }
  if (!s.accessToken.startsWith("APP_USR-")) {
    return "El Access Token no tiene el formato de Mercado Pago (empieza con APP_USR-).";
  }
  return null;
}

/** Últimos 4 caracteres que se pueden mostrar: token de MP o Client ID de PayPal. */
export function collectionSecretLast4(s: IntlCollectionSecret): string {
  const source = s.provider === "MERCADOPAGO_OWN" ? s.accessToken : s.clientId;
  return source.slice(-4);
}

/** CLF_INTL_PAYMENTS_ENV manda; si no, PROD solo con NODE_ENV === "production". */
export function resolveIntlPaymentsEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): IntlPaymentsEnvironment {
  const explicit = env.CLF_INTL_PAYMENTS_ENV;
  if (explicit === "TEST" || explicit === "PROD") return explicit;
  return env.NODE_ENV === "production" ? "PROD" : "TEST";
}
