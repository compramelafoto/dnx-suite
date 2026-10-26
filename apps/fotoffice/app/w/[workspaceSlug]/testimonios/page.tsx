import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildBlogMetadata } from "@/lib/blog/public-seo";
import { listarTestimoniosPublicos } from "@/lib/testimonios/publico";
import { loadPublicSite, type PublicSite } from "@/lib/website/public-site";
import { TESTIMONIO_FORM_SEGMENT, TESTIMONIOS_PUBLIC_SEGMENT, WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { BlogEmpty, BlogFrame, BlogListHeader } from "@/components/website/blog/blog-frame";
import { TestimoniosGrilla } from "@/components/website/render/testimonios/testimonio-card";

type Props = {
  params: Promise<{ workspaceSlug: string }>;
};

/** Como Trabajos, es una sección del Sitio web: sin el módulo encendido no existe (404). */
async function cargarSitio(workspaceSlug: string): Promise<PublicSite | null> {
  const site = await loadPublicSite(workspaceSlug);
  if (!site || !site.enabledModuleKeys.has(WEBSITE_MODULE_KEY)) return null;
  return site;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const site = await cargarSitio(workspaceSlug);
  if (!site) return { title: "Testimonios" };
  return buildBlogMetadata(
    { workspaceId: site.workspaceId, slug: site.workspaceSlug, nombre: site.commercialName, logoUrl: site.logoUrl },
    {
      title: "Testimonios",
      description: `Lo que dicen los clientes de ${site.commercialName}.`,
      path: `/w/${site.workspaceSlug}/${TESTIMONIOS_PUBLIC_SEGMENT}`,
    },
  );
}

/**
 * Todos los testimonios publicados (con permiso del autor), los destacados primero, y el botón para
 * dejar uno. Vive dentro del sitio, bajo el mismo encabezado y pie que la portada. Si las tablas
 * todavía no existen (el SQL se aplica a mano), la lectura devuelve vacío: la página dice que no hay
 * testimonios, nunca da error.
 */
export default async function TestimoniosPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const site = await cargarSitio(workspaceSlug);
  if (!site) notFound();

  const testimonios = await listarTestimoniosPublicos(site.workspaceId);

  return (
    <BlogFrame>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6 sm:py-16 md:space-y-14">
        <BlogListHeader eyebrow="Testimonios" title="Lo que dicen de nosotros" description={`Lo que cuentan los clientes de ${site.commercialName}.`} />
        {testimonios.length > 0 ? <TestimoniosGrilla testimonios={testimonios} /> : <BlogEmpty>Todavía no hay testimonios publicados.</BlogEmpty>}
        <div className="flex justify-center">
          <Link
            href={`/w/${site.workspaceSlug}/${TESTIMONIO_FORM_SEGMENT}`}
            className="inline-flex font-semibold"
            style={{
              borderRadius: "var(--wsite-button-radius)",
              paddingInline: "var(--wsite-button-padding-x)",
              paddingBlock: "var(--wsite-button-padding-y)",
              backgroundColor: "var(--wsite-primary)",
              color: "#ffffff",
            }}
          >
            Dejá tu testimonio
          </Link>
        </div>
      </div>
    </BlogFrame>
  );
}
