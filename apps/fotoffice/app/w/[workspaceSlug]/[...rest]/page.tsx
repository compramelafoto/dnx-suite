import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { loadPublicSite, resolvePublicCustomPage } from "@/lib/website/public-site";
import { buscarRedireccion } from "@/lib/website/redirecciones";
import { destinoBajoPrefijo } from "@/lib/website/redirecciones-reglas";
import { loadWebsiteDynamicData } from "@/lib/website/dynamic-data.server";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";

type Props = {
  params: Promise<{ workspaceSlug: string; rest: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Captura todas las rutas bajo /w/[workspaceSlug] que no coinciden con páginas definidas.
 * Si lo que sigue es el slug de una página propia de la versión PUBLICADA del sitio, la dibuja;
 * si no, antes del 404 mira las redirecciones del sitio (`/sobre` → `/quien-soy` de la web vieja)
 * y, si tampoco hay, dispara el `not-found.tsx` del segmento (el comportamiento de siempre).
 *
 * Acá sólo llegan las rutas que no existen: en `/w/<slug>/cursos` manda el módulo de cursos y una
 * redirección `/cursos` no se mira. Esa redirección sí corre en el dominio propio, donde el proxy
 * consulta las redirecciones antes de las rutas reales (`lib/website/domain/routing.ts`).
 */
export default async function CatchAllRoute({ params, searchParams }: Props) {
  const { workspaceSlug, rest } = await params;
  const site = await loadPublicSite(workspaceSlug);
  if (!site) notFound();

  const page = resolvePublicCustomPage(site, rest);
  if (!page) {
    const destino = await buscarRedireccion(site.workspaceId, rutaPedida(rest, await searchParams));
    if (destino) {
      const url = destinoBajoPrefijo(destino.hacia, `/w/${workspaceSlug}`);
      if (destino.codigo === 302) redirect(url);
      permanentRedirect(url);
    }
    notFound();
  }

  // Igual que la portada: los bloques dinámicos leen su contenido al dibujar.
  const dynamicData = await loadWebsiteDynamicData(site, page.blocks);
  return (
    <main>
      <WebsitePageRenderer blocks={page.blocks} colors={site.colors} designPresets={site.designPresets} dynamicData={dynamicData} />
    </main>
  );
}

/** La ruta del sitio que se pidió, con su consulta (la usan `post.php?id=` y se pasa al destino). */
function rutaPedida(rest: string[], query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    for (const valor of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, valor);
  }
  const consulta = params.toString();
  return `/${rest.join("/")}${consulta ? `?${consulta}` : ""}`;
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
