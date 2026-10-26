import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildBlogMetadata } from "@/lib/blog/public-seo";
import { textoConsentimiento } from "@/lib/testimonios/dominio";
import { leerInvitacion, type LecturaInvitacion } from "@/lib/testimonios/invitaciones";
import { loadPublicSite, type PublicSite } from "@/lib/website/public-site";
import { TESTIMONIO_FORM_SEGMENT, WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { BlogFrame, BlogListHeader } from "@/components/website/blog/blog-frame";
import { FormularioTestimonio, MensajeEnlace } from "@/components/website/testimonios/formulario-testimonio";

type Props = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** Como `/testimonios`, es una sección del Sitio web: sin el módulo encendido no existe (404). */
async function cargarSitio(workspaceSlug: string): Promise<PublicSite | null> {
  const site = await loadPublicSite(workspaceSlug);
  if (!site || !site.enabledModuleKeys.has(WEBSITE_MODULE_KEY)) return null;
  return site;
}

function tokenDe(valor: string | string[] | undefined): string | null {
  const t = Array.isArray(valor) ? valor[0] : valor;
  return t?.trim() ? t.trim() : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const site = await cargarSitio(workspaceSlug);
  if (!site) return { title: "Dejá tu testimonio" };
  const personal = tokenDe((await searchParams).t) !== null;
  const meta = buildBlogMetadata(
    { workspaceId: site.workspaceId, slug: site.workspaceSlug, nombre: site.commercialName, logoUrl: site.logoUrl },
    {
      title: "Dejá tu testimonio",
      description: `Contale a otros cómo fue tu experiencia con ${site.commercialName}.`,
      path: `/w/${site.workspaceSlug}/${TESTIMONIO_FORM_SEGMENT}`,
      // El enlace personal no se indexa y su token no sale en el `Referer` hacia otros sitios.
      noIndex: personal,
    },
  );
  return personal ? { ...meta, referrer: "no-referrer" } : meta;
}

/**
 * Formulario de testimonio: abierto (`/testimonio`) o personal (`/testimonio?t=<token>`, prellenado
 * con el nombre y el trabajo). Un enlace personal usado, vencido o de otro estudio muestra un
 * mensaje amable en vez del formulario: nunca crea un segundo testimonio (lo vuelve a mirar la
 * acción, en la misma transacción en que lo usa).
 */
export default async function TestimonioPage({ params, searchParams }: Props) {
  const { workspaceSlug } = await params;
  const site = await cargarSitio(workspaceSlug);
  if (!site) notFound();

  const token = tokenDe((await searchParams).t);
  const lectura: LecturaInvitacion | null = token ? await leerInvitacion(site.workspaceId, token) : null;
  const enlaceAbierto = `/w/${site.workspaceSlug}/${TESTIMONIO_FORM_SEGMENT}`;

  return (
    <BlogFrame>
      <div className="mx-auto max-w-2xl space-y-10 px-4 py-12 sm:px-6 sm:py-16">
        <BlogListHeader
          eyebrow="Testimonios"
          title="Dejá tu testimonio"
          description={`Contanos cómo fue tu experiencia con ${site.commercialName}. Lo leemos antes de publicarlo.`}
        />
        {lectura && lectura.estado !== "VALIDA" ? (
          <MensajeEnlace estado={lectura.estado} enlaceAbierto={enlaceAbierto} />
        ) : (
          <FormularioTestimonio
            workspaceSlug={site.workspaceSlug}
            estudio={site.commercialName}
            textoPermiso={textoConsentimiento(site.commercialName)}
            token={lectura?.estado === "VALIDA" ? token : null}
            nombreSugerido={lectura?.estado === "VALIDA" ? lectura.inv.nombreSugerido : null}
            detalleSugerido={lectura?.estado === "VALIDA" ? lectura.inv.detalleSugerido : null}
            enlaceAbierto={enlaceAbierto}
          />
        )}
      </div>
    </BlogFrame>
  );
}
