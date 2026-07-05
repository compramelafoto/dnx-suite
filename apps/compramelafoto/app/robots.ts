import type { MetadataRoute } from "next";
import { getDefaultSitemapOrigin } from "@/lib/blog/blog-metadata";

export default function robots(): MetadataRoute.Robots {
  const origin = getDefaultSitemapOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/dashboard/", "/fotografo/", "/cliente/", "/lab/", "/organizador/"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
