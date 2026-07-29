/**
 * Experiencia adaptativa de Home según perfiles públicos DNX.
 * No toca roles editoriales ni User.role.
 */

import type { PublicProfileType } from "./dnx-user-profiles";
import { isPublicProfileType } from "./dnx-user-profiles";

export type HomeExperienceMode = PublicProfileType | "GUEST";

/** Bloques de Home reordenables (sin nuevas features de negocio). */
export type HomeBlockId =
  | "hero"
  | "organizer_pitch"
  | "how_it_works"
  | "why_publish"
  | "featured_events"
  | "unified_feed"
  | "upcoming_events"
  | "photographer_calls"
  | "near_you"
  | "coverages"
  | "category_favorites"
  | "news"
  | "institutional";

export type HomeHeaderLink = {
  href: string;
  label: string;
};

export type HomeExperience = {
  mode: HomeExperienceMode;
  /** Perfiles ACTIVE del usuario (vacío si visitante). */
  availableModes: PublicProfileType[];
  /** True si el usuario puede cambiar el modo visual. */
  canSwitchMode: boolean;
  blocks: HomeBlockId[];
  /** CTA principal del header (null = ocultar). */
  headerPrimaryCta: HomeHeaderLink | null;
  /** Accesos secundarios del header relacionados al modo. */
  headerSecondaryLinks: HomeHeaderLink[];
  /** Título corto del modo (UI switcher). */
  modeLabel: string;
};

/** Cookie no-httpOnly para el último modo visual (no muta DnxUserProfile). */
export const HOME_EXPERIENCE_COOKIE = "infospot_home_experience";

/**
 * Prioridad por defecto cuando hay multi-perfil y no hay cookie válida.
 * Supply-side primero: ORGANIZER → PHOTOGRAPHER → CUSTOMER.
 */
export const HOME_MODE_DEFAULT_PRIORITY = [
  "ORGANIZER",
  "PHOTOGRAPHER",
  "CUSTOMER",
] as const satisfies readonly PublicProfileType[];

const MODE_LABELS: Record<HomeExperienceMode, string> = {
  GUEST: "Visitante",
  CUSTOMER: "Descubrir",
  PHOTOGRAPHER: "Fotógrafo",
  ORGANIZER: "Organizador",
};

const BLOCKS_BY_MODE: Record<HomeExperienceMode, HomeBlockId[]> = {
  GUEST: [
    "hero",
    "organizer_pitch",
    "how_it_works",
    "why_publish",
    "featured_events",
    "unified_feed",
    "upcoming_events",
    "photographer_calls",
    "near_you",
    "coverages",
    "news",
    "institutional",
  ],
  CUSTOMER: [
    "hero",
    "unified_feed",
    "upcoming_events",
    "near_you",
    "category_favorites",
    "coverages",
    "news",
    "featured_events",
    "photographer_calls",
    "organizer_pitch",
    "institutional",
  ],
  PHOTOGRAPHER: [
    "hero",
    "photographer_calls",
    "unified_feed",
    "coverages",
    "upcoming_events",
    "featured_events",
    "news",
    "near_you",
    "category_favorites",
    "institutional",
  ],
  ORGANIZER: [
    "hero",
    "organizer_pitch",
    "how_it_works",
    "featured_events",
    "unified_feed",
    "upcoming_events",
    "photographer_calls",
    "news",
    "coverages",
    "near_you",
    "institutional",
  ],
};

function uniqueProfiles(profiles: PublicProfileType[]): PublicProfileType[] {
  const set = new Set(profiles);
  return HOME_MODE_DEFAULT_PRIORITY.filter((p) => set.has(p)).concat(
    [...set].filter((p) => !(HOME_MODE_DEFAULT_PRIORITY as readonly string[]).includes(p)),
  );
}

export function pickDefaultHomeMode(
  activeProfiles: PublicProfileType[],
): HomeExperienceMode {
  if (activeProfiles.length === 0) return "GUEST";
  for (const mode of HOME_MODE_DEFAULT_PRIORITY) {
    if (activeProfiles.includes(mode)) return mode;
  }
  return activeProfiles[0]!;
}

export function parseHomeExperienceCookie(
  raw: string | null | undefined,
): PublicProfileType | null {
  if (!raw) return null;
  const value = raw.trim().toUpperCase();
  return isPublicProfileType(value) ? value : null;
}

function headerForMode(mode: HomeExperienceMode): {
  primary: HomeHeaderLink | null;
  secondary: HomeHeaderLink[];
} {
  switch (mode) {
    case "ORGANIZER":
      return {
        primary: { href: "/publicar-evento", label: "Publicar evento" },
        secondary: [
          { href: "/eventos", label: "Eventos" },
          { href: "/colaboradores", label: "Fotógrafos" },
        ],
      };
    case "PHOTOGRAPHER":
      return {
        primary: { href: "/eventos", label: "Convocatorias" },
        secondary: [
          { href: "/noticias", label: "Noticias" },
          { href: "/colaboradores", label: "Autores" },
        ],
      };
    case "CUSTOMER":
      return {
        primary: { href: "/eventos", label: "Eventos" },
        secondary: [
          { href: "/noticias", label: "Noticias" },
          { href: "/publicar-evento", label: "Publicar" },
        ],
      };
    case "GUEST":
    default:
      return {
        primary: { href: "/publicar-evento", label: "Publicar evento" },
        secondary: [],
      };
  }
}

/**
 * Determina modo visual, orden de bloques y CTAs del header.
 * `preferredMode` viene de cookie; solo aplica si está en perfiles ACTIVE.
 */
export function resolveHomeExperience(input: {
  activeProfiles: PublicProfileType[];
  preferredMode?: PublicProfileType | null;
}): HomeExperience {
  const availableModes = uniqueProfiles(input.activeProfiles);
  const preferred =
    input.preferredMode && availableModes.includes(input.preferredMode)
      ? input.preferredMode
      : null;
  const mode: HomeExperienceMode =
    preferred ?? pickDefaultHomeMode(availableModes);
  const { primary, secondary } = headerForMode(mode);

  return {
    mode,
    availableModes,
    canSwitchMode: availableModes.length > 1,
    blocks: BLOCKS_BY_MODE[mode],
    headerPrimaryCta: primary,
    headerSecondaryLinks: secondary,
    modeLabel: MODE_LABELS[mode],
  };
}
