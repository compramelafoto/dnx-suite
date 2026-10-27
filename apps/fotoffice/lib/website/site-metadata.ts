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
 * - Imagen: la elegida en Sitio web → Ajustes; si no hay, el logo de la institución y, sin
 *   logo, la portada.
 * - Palabras clave y verificación de Google: las de Sitio web → Ajustes (versión publicada).
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
  /** Sitio web → Ajustes (opcionales: sin ellos, el comportamiento de siempre). */
  keywords?: string[];
  shareImageUrl?: string | null;
  googleVerification?: string | null;
};

const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim() || null;

export function buildSiteMetadata(input: SiteMetadataInput): Metadata {
  const title = clean(input.seoTitle) ?? input.commercialName;
  const description = clean(input.seoDescription) ?? clean(input.shortDescription) ?? undefined;
  const shareImage = input.shareImageUrl || null;
  const image = shareImage || input.logoUrl || input.coverImageUrl || null;
  const icon = input.faviconUrl || input.logoUrl || null;
  const keywords = input.keywords?.length ? input.keywords : null;

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    ...(input.googleVerification ? { verification: { google: input.googleVerification } } : {}),
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
    // Un logo se ve mejor en la tarjeta chica (cuadrada) que estirado en la grande; una foto
    // elegida para compartir, en la grande.
    twitter: {
      card: shareImage ? "summary_large_image" : "summary",
      title,
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
    },
  };
}

export type CustomPageMetadataInput = {
  commercialName: string;
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  shareImageUrl?: string;
  hideFromSearch?: boolean;
};

/**
 * Metadata de una página propia del sitio. Sin imagen propia hereda la del layout (la del sitio).
 * Con imagen, `openGraph` se arma entero porque Next no combina objetos anidados: el de la página
 * reemplaza al del layout.
 */
export function buildCustomPageMetadata(input: CustomPageMetadataInput): Metadata {
  const title = `${input.seoTitle?.trim() || input.title} · ${input.commercialName}`;
  const description = clean(input.seoDescription) ?? undefined;
  const image = input.shareImageUrl || null;

  return {
    title,
    ...(description ? { description } : {}),
    ...(input.hideFromSearch ? { robots: { index: false, follow: true } } : {}),
    ...(image
      ? {
          openGraph: {
            type: "website",
            locale: "es_AR",
            siteName: input.commercialName,
            title,
            ...(description ? { description } : {}),
            images: [{ url: image, alt: input.title }],
          },
          twitter: { card: "summary_large_image", title, ...(description ? { description } : {}), images: [image] },
        }
      : {}),
  };
}
