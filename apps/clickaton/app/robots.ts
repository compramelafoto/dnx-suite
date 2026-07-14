import type { MetadataRoute } from "next";

/**
 * Robots provisionales: indexación deshabilitada hasta confirmar dominio y lanzamiento.
 * /design-system permanece excluida explícitamente.
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
