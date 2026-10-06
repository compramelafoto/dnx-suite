import type { Metadata } from "next";

/**
 * Título, descripción e imagen del sitio público para Google y para la vista previa al
 * compartir el enlace (WhatsApp, Facebook, X). Función pura: el layout de `/w/[slug]` le pasa
 * los datos y devuelve la `Metadata` de Next.
 *
 * Prioridades:
 * - Título: el de Sitio web → SEO (versión publicada) o, si no hay, el nombre de la institución.
 * - Descripción: la de Sitio web → SEO o, si no hay, la «Descripción breve» de Datos de la
 *   institución.
 * - Imagen: el logo de la institución; sin logo, la portada.
 */
export const SHORT_DESCRIPTION_MAX = 300;

export type SiteMetadataInput = {
  commercialName: string;
  seoTitle: string | null;
  seoDescription: string | null;
  shortDescription: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  faviconUrl: string | null;
};

const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim() || null;

export function buildSiteMetadata(input: SiteMetadataInput): Metadata {
  const title = clean(input.seoTitle) ?? input.commercialName;
  const description = clean(input.seoDescription) ?? clean(input.shortDescription) ?? undefined;
  const image = input.logoUrl || input.coverImageUrl || null;
  const icon = input.faviconUrl || input.logoUrl || null;

  return {
    title,
    description,
    ...(icon ? { icons: { icon } } : {}),
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: input.commercialName,
      title,
      ...(description ? { description } : {}),
      // Sin `url`: el layout la heredaría a todas las páginas y al compartir /socios la vista
      // previa apuntaría a la portada. Sin ella, cada red usa la dirección que se compartió.
      ...(image ? { images: [{ url: image, alt: input.commercialName }] } : {}),
    },
    // Un logo se ve mejor en la tarjeta chica (cuadrada) que estirado en la grande.
    twitter: {
      card: "summary",
      title,
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
    },
  };
}
