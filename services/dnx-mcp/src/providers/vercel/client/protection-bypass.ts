/**
 * Vercel Deployment Protection — Protection Bypass for Automation.
 *
 * Docs: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
 *
 * Nunca loguear el valor del secret.
 */

export const VERCEL_PROTECTION_BYPASS_HEADER = "x-vercel-protection-bypass";
export const VERCEL_SET_BYPASS_COOKIE_HEADER = "x-vercel-set-bypass-cookie";

export interface ProtectionBypassResolution {
  /** True si hay secret usable (no vacío). */
  enabled: boolean;
  /** Presente solo cuando enabled; no exponer en logs/reportes. */
  secret?: string;
}

/**
 * Resuelve el secret desde process.env (o un env inyectado en tests).
 * No lee caché de loadEnv para permitir override en tests sin reset global.
 */
export function resolveProtectionBypassSecret(
  env: NodeJS.ProcessEnv = process.env,
): ProtectionBypassResolution {
  const raw = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (typeof raw !== "string") {
    return { enabled: false };
  }
  const secret = raw.trim();
  if (!secret) {
    return { enabled: false };
  }
  return { enabled: true, secret };
}

/**
 * Headers oficiales de bypass. No incluye el secret en ningún campo logueable.
 */
export function buildProtectionBypassHeaders(
  options: {
    secret?: string | undefined;
    /** Si true, pide Set-Cookie de bypass (navegación / follow-up). Default false para probes API. */
    setBypassCookie?: boolean;
    env?: NodeJS.ProcessEnv;
  } = {},
): Record<string, string> {
  const resolved =
    options.secret !== undefined
      ? options.secret.trim()
        ? { enabled: true as const, secret: options.secret.trim() }
        : { enabled: false as const }
      : resolveProtectionBypassSecret(options.env);

  if (!resolved.enabled || !resolved.secret) {
    return {};
  }

  const headers: Record<string, string> = {
    [VERCEL_PROTECTION_BYPASS_HEADER]: resolved.secret,
  };

  if (options.setBypassCookie) {
    headers[VERCEL_SET_BYPASS_COOKIE_HEADER] = "true";
  }

  return headers;
}

/**
 * Mergea headers de caller con bypass (bypass gana en la clave oficial).
 */
export function withProtectionBypassHeaders(
  headers: Record<string, string> = {},
  options?: Parameters<typeof buildProtectionBypassHeaders>[0],
): Record<string, string> {
  return {
    ...headers,
    ...buildProtectionBypassHeaders(options),
  };
}

/** Metadata segura para reportes/logs (nunca el secret). */
export function protectionBypassStatus(env: NodeJS.ProcessEnv = process.env): {
  enabled: boolean;
  header: typeof VERCEL_PROTECTION_BYPASS_HEADER;
} {
  return {
    enabled: resolveProtectionBypassSecret(env).enabled,
    header: VERCEL_PROTECTION_BYPASS_HEADER,
  };
}
