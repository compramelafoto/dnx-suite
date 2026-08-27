/**
 * Configuración del checkout de FotoRank (Mercado Pago Checkout Pro, sin split).
 *
 * Decisión de arquitectura (2026-08-26): este concurso cobra a una única cuenta
 * —organizador y receptor son la misma— así que NO usa Orders API Split 1:N.
 * No hay receivers de terceros, ni consentimientos de partner, ni distribución.
 *
 * Credenciales propias de FotoRank: deliberadamente NO se reutiliza la variable
 * `MP_ACCESS_TOKEN` de Comprame la Foto. Aislar las credenciales por aplicación
 * permite cambiar de cuenta, rotar un token o revocar un acceso sin tocar
 * el cobro de otro producto que ya está en producción.
 */

export const FOTORANK_CHECKOUT_FLAG = "FOTORANK_CHECKOUT_ENABLED" as const;
export const FOTORANK_MP_ACCESS_TOKEN = "FOTORANK_MP_ACCESS_TOKEN" as const;
export const FOTORANK_MP_WEBHOOK_SECRET = "FOTORANK_MP_WEBHOOK_SECRET" as const;
export const FOTORANK_PUBLIC_URL_VAR = "FOTORANK_PUBLIC_URL" as const;

export type CheckoutEnvironment = "sandbox" | "production";

export type CheckoutConfig = {
  enabled: boolean;
  accessToken: string | null;
  webhookSecret: string | null;
  publicUrl: string | null;
  environment: CheckoutEnvironment;
  /** True si el token es de prueba (prefijo TEST-). */
  tokenIsTest: boolean;
};

function truthy(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Un token `TEST-` nunca puede cobrar de verdad. */
export function isTestAccessToken(token: string | null): boolean {
  return Boolean(token && token.trim().toUpperCase().startsWith("TEST-"));
}

export function loadCheckoutConfig(
  env: Record<string, string | undefined> = process.env,
): CheckoutConfig {
  const accessToken = env[FOTORANK_MP_ACCESS_TOKEN]?.trim() || null;
  const vercelEnv = (env.VERCEL_ENV ?? "").toLowerCase();
  const environment: CheckoutEnvironment =
    vercelEnv === "production" ? "production" : "sandbox";

  return {
    enabled: truthy(env[FOTORANK_CHECKOUT_FLAG]),
    accessToken,
    webhookSecret: env[FOTORANK_MP_WEBHOOK_SECRET]?.trim() || null,
    publicUrl: env[FOTORANK_PUBLIC_URL_VAR]?.trim() || null,
    environment,
    tokenIsTest: isTestAccessToken(accessToken),
  };
}

export type ConfigReadiness =
  | { ready: true; config: CheckoutConfig }
  | { ready: false; reason: string; missing: string[] };

/**
 * ¿El checkout está listo para operar? Falla cerrado.
 *
 * En producción se rechaza explícitamente una credencial de prueba: cobrar con
 * un token `TEST-` en producción significa que el pago no existe de verdad.
 */
export function checkConfigReadiness(
  env: Record<string, string | undefined> = process.env,
): ConfigReadiness {
  const config = loadCheckoutConfig(env);
  const missing: string[] = [];

  if (!config.enabled) {
    return {
      ready: false,
      reason: `El checkout de FotoRank está deshabilitado (${FOTORANK_CHECKOUT_FLAG} apagado).`,
      missing: [FOTORANK_CHECKOUT_FLAG],
    };
  }
  if (!config.accessToken) missing.push(FOTORANK_MP_ACCESS_TOKEN);
  if (!config.webhookSecret) missing.push(FOTORANK_MP_WEBHOOK_SECRET);
  if (!config.publicUrl) missing.push(FOTORANK_PUBLIC_URL_VAR);

  if (missing.length > 0) {
    return {
      ready: false,
      reason: `Faltan variables de configuración del checkout: ${missing.join(", ")}.`,
      missing,
    };
  }

  if (config.environment === "production" && config.tokenIsTest) {
    return {
      ready: false,
      reason:
        "Credencial de prueba (TEST-) en producción: el cobro no sería real. " +
        `Configurá ${FOTORANK_MP_ACCESS_TOKEN} de producción (APP_USR-…).`,
      missing: [FOTORANK_MP_ACCESS_TOKEN],
    };
  }

  return { ready: true, config };
}
