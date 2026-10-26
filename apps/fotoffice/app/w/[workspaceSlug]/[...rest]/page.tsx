import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicSite, resolvePublicCustomPage } from "@/lib/website/public-site";
import { loadWebsiteDynamicData } from "@/lib/website/dynamic-data.server";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";

type Props = { params: Promise<{ workspaceSlug: string; rest: string[] }> };

/**
 * Captura todas las rutas bajo /w/[workspaceSlug] que no coinciden con páginas definidas.
 * Si lo que sigue es el slug de una página propia de la versión PUBLICADA del sitio, la dibuja;
 * si no, dispara el `not-found.tsx` del segmento (el comportamiento de siempre).
 */
export default async function CatchAllRoute({ params }: Props) {
  const { workspaceSlug, rest } = await params;
  const site = await loadPublicSite(workspaceSlug);
  if (!site) notFound();

  const page = resolvePublicCustomPage(site, rest);
  if (!page) notFound();

  // Igual que la portada: los bloques dinámicos leen su contenido al dibujar.
  const dynamicData = await loadWebsiteDynamicData(site, page.blocks);
  return (
    <main>
      <WebsitePageRenderer blocks={page.blocks} colors={site.colors} designPresets={site.designPresets} dynamicData={dynamicData} />
    </main>
  );
}

/** Título (el SEO de la página, o su nombre) con el nombre comercial, y su descripción propia. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, rest } = await params;
  const site = await loadPublicSite(workspaceSlug);
  const page = site ? resolvePublicCustomPage(site, rest) : null;
  if (!site || !page) return {};
  return {
    title: `${page.meta.seoTitle?.trim() || page.meta.title} · ${site.commercialName}`,
    ...(page.meta.seoDescription?.trim() ? { description: page.meta.seoDescription.trim() } : {}),
  };
}
