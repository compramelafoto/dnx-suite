import type { MetadataRoute } from "next";
import { getDefaultSitemapOrigin } from "@/lib/blog/blog-metadata";

/**
 * El indexado se habilita SOLO con `CLF_ALLOW_SEARCH_INDEXING=true`.
 *
 * Durante la migración conviven dos despliegues con el mismo contenido: el sitio
 * productivo (`www.compramelafoto.com`) y el del monorepo
 * (`compramelafoto.dnxsuite.com`). Los dos son `production` para Vercel, así que
 * `VERCEL_ENV` no alcanza para distinguirlos: hace falta el flag explícito.
 *
 * Sin el flag el sitio queda cerrado a buscadores, y así el despliegue de prueba
 * no compite con el productivo por el mismo contenido.
 *
 * En el cutover: encender el flag en el proyecto que sirva el dominio final.
 */
export default function robots(): MetadataRoute.Robots {
  const allowIndexing = process.env.CLF_ALLOW_SEARCH_INDEXING === "true";

  if (!allowIndexing) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

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
