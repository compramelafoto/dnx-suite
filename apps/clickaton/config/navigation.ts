/**
 * Rutas públicas tipadas — fuente única para nav, CTAs y metadata.
 */

export const routes = {
  home: "/",
  marathons: "/maratones",
  howItWorks: "/como-funciona",
  community: "/comunidad",
  /** Landing “Llevá Clickatón a tu ciudad” — Organizadores Oficiales de Sede. */
  organize: "/organizar",
  /** @deprecated Usar `joinUs` (`/formar-parte`). Redirect permanente en next.config. */
  sponsors: "/formar-parte",
  /** @deprecated Preferir `joinUs`. Redirect de compatibilidad en `/aliados-fundadores`. */
  foundingAllies: "/formar-parte",
  /** Landing institucional para empresas e instituciones que quieran acompañar Clickatón. */
  joinUs: "/formar-parte",
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
  { label: "Llevá Clickatón a tu ciudad", href: routes.organize },
  { label: "Formá parte", href: routes.joinUs },
] as const;

/** Footer: nav principal + páginas institucionales. */
export const footerNavigation: readonly NavItem[] = [
  { label: "Maratones", href: routes.marathons },
  { label: "Cómo funciona", href: routes.howItWorks },
  { label: "Comunidad", href: routes.community },
  { label: "Llevá Clickatón a tu ciudad", href: routes.organize },
  { label: "Formá parte", href: routes.joinUs },
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
