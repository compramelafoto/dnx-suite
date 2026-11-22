import { prisma } from "@repo/db";
import { marcaPorHost } from "@/lib/marca";
import { TOPE_SITEMAP, urlsDelSitemap, urlsFijas, xmlDelSitemap } from "@/lib/sitio/sitemap";

// Depende del dominio del pedido: no puede ser estática. El CDN lo cachea una hora por host.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const marca = marcaPorHost(req.headers.get("host"));
  const [muestras, perfiles] = await Promise.all([
    prisma.culturalActivity.findMany({
      where: { reviewStatus: "APPROVED" },
      select: { slug: true, primaryDiscipline: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: TOPE_SITEMAP,
    }),
    prisma.photographerProfile.findMany({
      where: { works: { some: { activity: { reviewStatus: "APPROVED", type: "MUESTRA" } } } },
      select: { slug: true, disciplines: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: TOPE_SITEMAP,
    }),
  ]);
  const fijas = urlsFijas(marca).map((loc) => ({ loc }));
  const urls = [...fijas, ...urlsDelSitemap(marca.id, muestras, perfiles)].slice(0, TOPE_SITEMAP);
  return new Response(xmlDelSitemap(urls), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600" },
  });
}
