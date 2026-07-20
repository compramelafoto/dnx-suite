/**
 * Rutas públicas tipadas — fuente única para nav, CTAs y metadata.
 */

export const routes = {
  home: "/",
  marathons: "/maratones",
  howItWorks: "/como-funciona",
  community: "/comunidad",
  organize: "/organizar",
  /** @deprecated Preferir `foundingAllies`. Se mantiene por compatibilidad. */
  sponsors: "/sponsors",
  /** Experiencia pública “Aliados Fundadores” (propuesta para empresas). */
  foundingAllies: "/aliados-fundadores",
  about: "/nosotros",
  contact: "/contacto",
  /** Manual de marca público para sedes y diseñadores. */
  brandManual: "/manualdemarca",
  designSystem: "/design-system",
  /** Ficha técnica de demostración — noindex, fuera del nav principal. */
  marathonDemo: "/maratones/demo",
  /** Login unificado (usuarios + administradores). */
  login: "/login",
  account: "/mi-cuenta",
} as const;

export function marathonPath(slug: string): string {
  return `/maratones/${slug}`;
}

/** Flujo público de inscripción/reserva (10D3F). */
export function marathonRegistrationPath(slug: string): string {
  return `/maratones/${slug}/inscripcion`;
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
  { label: "Aliados", href: routes.foundingAllies },
] as const;

/** Footer: nav principal + páginas institucionales. */
export const footerNavigation: readonly NavItem[] = [
  { label: "Maratones", href: routes.marathons },
  { label: "Cómo funciona", href: routes.howItWorks },
  { label: "Comunidad", href: routes.community },
  { label: "Organizá una", href: routes.organize },
  { label: "Aliados Fundadores", href: routes.foundingAllies },
  { label: "Nosotros", href: routes.about },
  { label: "Manual de marca", href: routes.brandManual },
  { label: "Contacto", href: routes.contact },
] as const;

export const headerCta: NavItem = {
  label: "Ver maratones",
  href: routes.marathons,
};

/** Áreas futuras o fuera del nav público. */
export const futureAreas = [
  "tienda",
  "blog",
  "ranking",
  "galería",
  "hall de la fama",
  "perfiles",
  "inscripciones públicas",
  "checkout",
  /** Panel operativo: `/admin` (Etapa 10B), fuera del nav público. Login: `/login`. */
  "panel admin",
  "términos",
  "privacidad",
  "newsletter",
] as const;
