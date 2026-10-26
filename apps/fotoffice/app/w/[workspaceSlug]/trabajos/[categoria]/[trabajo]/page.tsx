import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { sanitizeContentHtml } from "@repo/content";
import { appUrl } from "@/lib/app-url";
import { blogAbsoluteUrl } from "@/lib/blog/public-seo";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { toVideoEmbedUrl } from "@/lib/website/embed-hosts";
import { categoriaConsultaParaTrabajo, obtenerTrabajoPublico, sumarVistaTrabajo } from "@/lib/trabajos/publico";
import { cargarSitioDeTrabajos, metadataDeTrabajos, trabajosPath } from "@/lib/trabajos/paginas.server";
import { enlacePresupuesto, serializarGaleriaJsonLd } from "@/lib/trabajos/sitio-publico";
import { BlogArticleBody } from "@/components/website/blog/blog-article-body";
import { BlogButtonLink, BlogFrame } from "@/components/website/blog/blog-frame";
import { BLOG_HEADING_STYLE, BLOG_SOFT_BORDER } from "@/components/website/blog/blog-post-card";
import { TrabajoGaleria } from "@/components/website/render/trabajos/trabajo-galeria";
import { TrabajosGrilla, urlMostrable } from "@/components/website/render/trabajos/trabajos-grilla";

type Props = { params: Promise<{ workspaceSlug: string; categoria: string; trabajo: string }> };

// Cada visita suma una vista: la ficha se arma siempre en el momento.
export const dynamic = "force-dynamic";

/** La metadata y la página piden el mismo trabajo: una sola consulta por request. Un borrador o
 * un trabajo de una categoría oculta no vuelve (`obtenerTrabajoPublico`) → 404. */
const cargar = cache(async (workspaceSlug: string, categoriaSlug: string, slug: string) => {
  const site = await cargarSitioDeTrabajos(workspaceSlug);
  if (!site) return null;
  const trabajo = await obtenerTrabajoPublico(site.workspaceId, categoriaSlug, slug, { base: `/w/${site.workspaceSlug}` });
  return trabajo ? { site, trabajo } : null;
});

/** Texto plano para la descripción de buscadores: la elegida, o el comienzo de la descripción. */
function descripcionCorta(seo: string | null, html: string | null, porOmision: string): string {
  const elegida = seo?.trim();
  if (elegida) return elegida;
  const texto = (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!texto) return porOmision;
  return texto.length > 160 ? `${texto.slice(0, 157).trimEnd()}…` : texto;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, categoria, trabajo: slug } = await params;
  const data = await cargar(workspaceSlug, categoria, slug);
  if (!data) return { title: "Trabajo no encontrado", robots: { index: false, follow: false } };
  const { site, trabajo } = data;
  return metadataDeTrabajos(site, {
    title: trabajo.seoTitle?.trim() || trabajo.titulo,
    description: descripcionCorta(trabajo.seoDescription, trabajo.descripcionHtml, `${trabajo.categoriaNombre} · ${site.commercialName}`),
    path: trabajo.href,
    imageUrl: trabajo.portadaUrl,
  });
}

export default async function TrabajoPage({ params }: Props) {
  const { workspaceSlug, categoria, trabajo: slug } = await params;
  const data = await cargar(workspaceSlug, categoria, slug);
  if (!data) notFound();
  const { site, trabajo } = data;

  // Contar la vista no demora la página: corre después de responder, y si falla sólo se anota.
  after(() =>
    sumarVistaTrabajo(site.workspaceId, trabajo.id).catch((err: unknown) => {
      console.error("[fotoffice][trabajos] no se pudo contar la vista:", err);
    }),
  );

  const consultasEncendido = site.enabledModuleKeys.has(SERVICE_LEADS_MODULE_KEY);
  const categoriaConsulta = consultasEncendido ? await categoriaConsultaParaTrabajo(site.workspaceId, trabajo.categoriaNombre) : null;
  const presupuestoHref = enlacePresupuesto(site.workspaceSlug, consultasEncendido, categoriaConsulta);

  const fotos = trabajo.fotos
    .filter((f) => f.tipo === "FOTO" && urlMostrable(f.url))
    .map((f) => ({ id: f.id, url: f.url, alt: f.alt, ancho: f.ancho, alto: f.alto }));
  const videos = trabajo.fotos.flatMap((f) => {
    const src = f.tipo === "VIDEO_URL" ? toVideoEmbedUrl(f.url) : null;
    return src ? [{ id: f.id, src, titulo: f.alt || trabajo.titulo }] : [];
  });
  // El HTML ya se sanea al guardar; se vuelve a sanear acá porque llega al HTML de cualquiera.
  const descripcion = trabajo.descripcionHtml ? sanitizeContentHtml(trabajo.descripcionHtml) : "";
  const listado = trabajosPath(site.workspaceSlug);
  const detalle = [trabajo.lugar, trabajo.fechaTexto].filter(Boolean).join(" · ");
  const jsonLd = serializarGaleriaJsonLd({
    trabajo,
    url: blogAbsoluteUrl(trabajo.href),
    descripcion: descripcionCorta(trabajo.seoDescription, trabajo.descripcionHtml, trabajo.titulo),
    nombreSitio: site.commercialName,
    urlSitio: blogAbsoluteUrl(`/w/${site.workspaceSlug}`),
    appBase: appUrl(),
  });

  return (
    <BlogFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <article>
        <header className="mx-auto max-w-6xl space-y-5 px-4 pt-10 sm:px-6 sm:pt-14">
          <Link href={listado} className="inline-flex items-center gap-1 text-sm" style={{ color: "var(--wsite-text)", opacity: 0.7 }}>
            ← Trabajos
          </Link>
          <p>
            <Link
              href={`${listado}/${trabajo.categoriaSlug}`}
              className="text-xs font-semibold uppercase tracking-[0.18em] hover:underline"
              style={{ color: "var(--wsite-primary)" }}
            >
              {trabajo.categoriaNombre}
            </Link>
          </p>
          <h1 className="max-w-4xl text-[2rem] leading-[1.15] break-words sm:text-5xl" style={BLOG_HEADING_STYLE}>
            {trabajo.titulo}
          </h1>
          {detalle ? (
            <p className="text-sm" style={{ opacity: 0.65 }}>
              {detalle}
            </p>
          ) : null}
          {presupuestoHref ? (
            <p className="pt-2">
              <Link
                href={presupuestoHref}
                className="inline-flex items-center"
                style={{
                  borderRadius: "var(--wsite-button-radius)",
                  paddingInline: "var(--wsite-button-padding-x)",
                  paddingBlock: "var(--wsite-button-padding-y)",
                  fontWeight: "var(--wsite-button-weight)",
                  backgroundColor: "var(--wsite-primary)",
                  color: "#ffffff",
                }}
              >
                Pedir presupuesto
              </Link>
            </p>
          ) : null}
        </header>

        {descripcion ? (
          <div className="mx-auto max-w-[42rem] px-4 pt-10 sm:px-6">
            <BlogArticleBody html={descripcion} />
          </div>
        ) : null}

        <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 sm:py-12">
          {videos.map((v) => (
            <div key={v.id} className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
              <iframe
                src={v.src}
                title={v.titulo}
                className="h-full w-full border-0"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ))}
          <TrabajoGaleria fotos={fotos} titulo={trabajo.titulo} />
        </div>
      </article>

      {trabajo.relacionados.length > 0 ? (
        <section aria-labelledby="trabajos-tambien-vieron" className="border-t" style={{ borderColor: BLOG_SOFT_BORDER }}>
          <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6 sm:py-16">
            <h2 id="trabajos-tambien-vieron" className="text-2xl sm:text-3xl" style={BLOG_HEADING_STYLE}>
              También vieron
            </h2>
            <TrabajosGrilla trabajos={trabajo.relacionados} />
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <BlogButtonLink href={listado}>← Volver a Trabajos</BlogButtonLink>
      </div>
    </BlogFrame>
  );
}
