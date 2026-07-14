import type { MetadataRoute } from "next";

/**
 * Robots provisionales: sitio en prelanzamiento (noindex general).
 * /design-system permanece excluida de forma explícita.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/", "/design-system"],
      },
    ],
  };
}
