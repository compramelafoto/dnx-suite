/**
 * Gate de indexación para el blog CMS (staging vs producción).
 * Copia mínima self-contained — no depende de WIP en lib/seo.
 */
import {
  PRODUCTION_SITE_ORIGIN,
  isClickatonProductionPublicOrigin,
  isClickatonStagingPublicOrigin,
  resolveClickatonPublicOrigin,
} from "@/lib/site/public-origin";

export type ContentSearchIndexingDecision = {
  allowIndexing: boolean;
  origin: string;
  sitemapUrl: string | null;
  reason: string;
};

export function resolveContentSearchIndexing(
  env: Record<string, string | undefined> = process.env,
): ContentSearchIndexingDecision {
  const origin = resolveClickatonPublicOrigin(env);

  if (env.CLICKATON_FORCE_NOINDEX === "true") {
    return {
      allowIndexing: false,
      origin,
      sitemapUrl: null,
      reason: "CLICKATON_FORCE_NOINDEX",
    };
  }

  if (isClickatonStagingPublicOrigin(origin)) {
    return {
      allowIndexing: false,
      origin,
      sitemapUrl: null,
      reason: "STAGING_HOST",
    };
  }

  const vercelProdUrl = env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ?? "";
  if (/clickaton-staging/i.test(vercelProdUrl)) {
    return {
      allowIndexing: false,
      origin,
      sitemapUrl: null,
      reason: "STAGING_VERCEL_PROJECT",
    };
  }

  const explicitAllow = env.CLICKATON_ALLOW_SEARCH_INDEXING === "true";
  const productionHost = isClickatonProductionPublicOrigin(origin);

  if (productionHost || explicitAllow) {
    return {
      allowIndexing: true,
      origin,
      sitemapUrl: `${PRODUCTION_SITE_ORIGIN}/sitemap.xml`,
      reason: productionHost ? "PRODUCTION_HOST" : "EXPLICIT_ALLOW_FLAG",
    };
  }

  return {
    allowIndexing: false,
    origin,
    sitemapUrl: null,
    reason: "DEFAULT_NOINDEX",
  };
}
