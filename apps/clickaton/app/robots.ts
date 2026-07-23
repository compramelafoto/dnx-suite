import type { MetadataRoute } from "next";

/**
 * Robots depend on deploy environment (11B).
 * - local / preview / staging: noindex
 * - production: allow index only when CLICKATON_ALLOW_SEARCH_INDEXING=true
 * Never auto-enable indexing during 11B.
 */
export default function robots(): MetadataRoute.Robots {
  const vercelEnv = process.env.VERCEL_ENV; // production | preview | development
  const allow =
    vercelEnv === "production" &&
    process.env.CLICKATON_ALLOW_SEARCH_INDEXING === "true";

  if (!allow) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/design-system", "/mi-cuenta"],
      },
    ],
    sitemap: "https://maratonfotografica.com/sitemap.xml",
  };
}
