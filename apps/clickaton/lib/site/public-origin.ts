import { siteConfig } from "@/config/site";

/** Alias estable de staging Clickatón. */
export const STAGING_SITE_ORIGIN = "https://clickaton-staging.vercel.app";

/** Dominio productivo de marca (fallback de build / audiencia production). */
export const PRODUCTION_SITE_ORIGIN = "https://maratonfotografica.com";

/**
 * Fuente de verdad runtime para URLs públicas absolutas.
 *
 * Orden:
 * 1. CLICKATON_PUBLIC_URL
 * 2. CLICKATON_PUBLIC_WEB_BASE_URL
 * 3. NEXT_PUBLIC_APP_URL
 * 4. APP_URL
 * 5. Heurística Vercel project production URL (staging alias)
 * 6. siteConfig.url (marca / producción)
 */
export function resolveClickatonPublicOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  const candidates = [
    env.CLICKATON_PUBLIC_URL,
    env.CLICKATON_PUBLIC_WEB_BASE_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.APP_URL,
  ];
  for (const raw of candidates) {
    const v = raw?.trim().replace(/\/$/, "");
    if (v) return v;
  }

  const vercelProd = env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(
    /^https?:\/\//,
    "",
  );
  if (vercelProd && /clickaton-staging/i.test(vercelProd)) {
    return `https://${vercelProd.replace(/\/$/, "")}`;
  }

  return siteConfig.url.replace(/\/$/, "");
}

export function isClickatonProductionPublicOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === "maratonfotografica.com" ||
      host === "www.maratonfotografica.com"
    );
  } catch {
    return /maratonfotografica\.com/i.test(origin);
  }
}

export function isClickatonStagingPublicOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "clickaton-staging.vercel.app";
  } catch {
    return /clickaton-staging\.vercel\.app/i.test(origin);
  }
}

/**
 * Audiencia de producto (emails / links).
 * El host público explícito gana sobre VERCEL_ENV=production del proyecto staging.
 */
export function isClickatonProductionAudience(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const origin = resolveClickatonPublicOrigin(env);
  if (isClickatonStagingPublicOrigin(origin)) return false;
  if (isClickatonProductionPublicOrigin(origin)) return true;

  const productEnv =
    env.CLICKATON_PRODUCT_ENV?.trim() || env.CLICKATON_RELEASE_ENV?.trim();
  if (productEnv === "production" || productEnv === "prod") return true;

  const vercelEnv = env.VERCEL_ENV?.trim() || env.NODE_ENV?.trim();
  if (
    vercelEnv === "production" &&
    !/staging|localhost|127\.0\.0\.1/i.test(origin)
  ) {
    return true;
  }
  return false;
}
