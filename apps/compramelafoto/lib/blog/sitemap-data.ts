import { getContentSitemapEntries } from "@repo/content";
import { CLF_CONTENT_PLATFORM } from "@/lib/blog/content-platform";
import { prisma } from "@/lib/prisma";

/** Rutas estáticas públicas relevantes para SEO. */
export const PUBLIC_STATIC_SITEMAP_PATHS = [
  "",
  "/blog",
  "/tutoriales",
  "/terminos",
  "/privacidad",
  "/escuelas",
  "/directorio/fotografos",
  "/recomendanos",
] as const;

export async function getBlogSitemapEntries() {
  return getContentSitemapEntries({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
  });
}
