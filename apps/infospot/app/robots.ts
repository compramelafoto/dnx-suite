import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/settings";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/redaccion",
          "/redaccion/",
          "/invitar",
          "/invitar/",
          "/recuperar",
          "/recuperar/",
          "/design-system",
          "/api/",
          "/publicar-evento/gracias",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
