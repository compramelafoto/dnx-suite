/** Sponsors reales (DB Partners) para harness visual — sin tracking. */
export type VisualSponsor = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  localImage: string;
  title: string;
  body: string;
  ctaText: string;
};

/**
 * Fuente: DnxPartner + DnxPartnerAsset APPROVED leídos en CLF prod (solo lectura).
 * Hoy hay un único sponsor con asset aprobado en el snapshot de ads: Vicario.
 * El fileUrl CDN `/api/media/clickaton/...` responde 404; el PNG local es el logo
 * oficial de vicariodigital.com para la misma marca.
 */
export const VISUAL_SPONSORS: VisualSponsor[] = [
  {
    id: "cmsip1cf1001eits37kqtkyx6",
    slug: "grupovicario",
    name: "Vicario",
    websiteUrl: "https://vicariodigital.com",
    localImage: "/sponsors/vicario.png",
    title: "Vicario",
    body: "Nos acompañan en la fotografía y la cultura.",
    ctaText: "Conocer la marca",
  },
];

export function resolveVisualSponsor(slug?: string | null): VisualSponsor {
  const key = (slug || "").toLowerCase();
  return VISUAL_SPONSORS.find((s) => s.slug === key) || VISUAL_SPONSORS[0];
}
