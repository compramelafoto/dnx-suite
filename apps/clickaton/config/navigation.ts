/**
 * Rutas públicas tipadas — fuente única para nav, CTAs y metadata.
 */

export const routes = {
  home: "/",
  marathons: "/maratones",
  howItWorks: "/como-funciona",
  community: "/comunidad",
  organize: "/organizar",
  sponsors: "/sponsors",
  about: "/nosotros",
  contact: "/contacto",
  /** Manual de marca público para sedes y diseñadores. */
  brandManual: "/manualdemarca",
  designSystem: "/design-system",
  /** Ficha técnica de demostración — noindex, fuera del nav principal. */
  marathonDemo: "/maratones/demo",
} as const;

export function marathonPath(slug: string): string {
  return `/maratones/${slug}`;
}

export type AppRoute = (typeof routes)[keyof typeof routes];

export type NavItem = {
  label: string;
  href: AppRoute | string;
};

/** Navegación principal del header (rutas reales). Sin “Inicio”: el logo no enlaza al home. */
export const mainNavigation: readonly NavItem[] = [
  { label: "Maratones", href: routes.marathons },
  { label: "Cómo funciona", href: routes.howItWorks },
  { label: "Comunidad", href: routes.community },
  { label: "Organizá una", href: routes.organize },
  { label: "Sponsors", href: routes.sponsors },
] as const;

/** Footer: nav principal + páginas institucionales. */
export const footerNavigation: readonly NavItem[] = [
  { label: "Maratones", href: routes.marathons },
  { label: "Cómo funciona", href: routes.howItWorks },
  { label: "Comunidad", href: routes.community },
  { label: "Organizá una", href: routes.organize },
  { label: "Sponsors", href: routes.sponsors },
  { label: "Nosotros", href: routes.about },
  { label: "Manual de marca", href: routes.brandManual },
  { label: "Contacto", href: routes.contact },
] as const;

export const headerCta: NavItem = {
  label: "Ver maratones",
  href: routes.marathons,
};

/** Áreas futuras — sin enlaces públicos todavía. */
export const futureAreas = [
  "tienda",
  "blog",
  "ranking",
  "galería",
  "hall de la fama",
  "perfiles",
  "login",
  "inscripciones",
  "checkout",
  "paneles",
  "términos",
  "privacidad",
  "newsletter",
] as const;
