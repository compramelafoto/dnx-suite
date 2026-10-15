import type { DnxPartnerAdPlacementKey } from "@repo/partners";

/**
 * Las constantes del módulo de sponsors.
 *
 * Los sponsors no viven en la base de FOTOFFICE sino en DNX Partners (base de Clickatón),
 * compartidos con toda la suite. Lo que es de la institución es la participación —el vínculo
 * del sponsor con su workspace— y las asignaciones a sus espacios. Ver
 * `docs/superpowers/specs/2026-10-06-fotoffice-sponsors-design.md`.
 */

export const SPONSORS_MODULE_KEY = "sponsors";

/** La zona en la que la institución piensa sus fechas. */
export const SPONSORS_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Los espacios que la institución puede ocupar hoy. El catálogo declara seis; los otros dos
 * (ficha de beneficio y auspicio del sorteo) necesitan pantallas que todavía no existen.
 */
export const FOTOFFICE_SPONSOR_PLACEMENTS = [
  "FOTOFFICE_PUBLIC_MARQUEE",
  "FOTOFFICE_PORTAL_SPONSORS",
  "FOTOFFICE_PORTAL_WELCOME",
  "FOTOFFICE_PORTAL_MARQUEE",
] as const satisfies readonly DnxPartnerAdPlacementKey[];

export type SponsorPlacementKey = (typeof FOTOFFICE_SPONSOR_PLACEMENTS)[number];

const ROTULOS: Record<SponsorPlacementKey, { label: string; where: string }> = {
  FOTOFFICE_PUBLIC_MARQUEE: {
    label: "Franja de logos del sitio",
    where: "En la portada del sitio público. La ve cualquiera.",
  },
  FOTOFFICE_PORTAL_SPONSORS: {
    label: "Sponsors del portal",
    where: "Sección con logo, texto y enlace en el inicio del portal. Sólo socios.",
  },
  FOTOFFICE_PORTAL_WELCOME: {
    label: "Ventana al abrir el portal",
    where: "Aviso destacado al entrar al portal, una vez por visita. Sólo socios.",
  },
  FOTOFFICE_PORTAL_MARQUEE: {
    label: "Logos al pie del portal",
    where: "Franja de logos al pie de todas las páginas del portal. Sólo socios.",
  },
};

export function isSponsorPlacementKey(value: string): value is SponsorPlacementKey {
  return (FOTOFFICE_SPONSOR_PLACEMENTS as readonly string[]).includes(value);
}

export function placementLabel(key: SponsorPlacementKey): string {
  return ROTULOS[key].label;
}

export function placementWhere(key: SponsorPlacementKey): string {
  return ROTULOS[key].where;
}
