/**
 * Menú lateral del panel administrativo — fuente única de etiquetas visibles.
 */

export const adminRoutes = {
  dashboard: "/admin",
  editions: "/admin/ediciones",
  homeBanners: "/admin/banners-home",
  venues: "/admin/sedes",
  catalog: "/admin/catalogo",
  registrations: "/admin/inscripciones",
  promotions: "/admin/promociones",
  social: "/admin/social",
  sponsors: "/admin/sponsors",
  messages: "/admin/mensajes",
  settings: "/admin/configuracion",
  financeOwner: "/admin/finanzas/cuenta-owner",
  /** Partner / recipient self-connect (Mi cuenta de cobro). */
  financePartner: "/admin/finanzas/mi-cuenta",
  integrations: "/admin/integraciones",
  /** Compat: redirige al login unificado `/login`. */
  login: "/admin/login",
  unifiedLogin: "/login",
  forbidden: "/admin/acceso-denegado",
} as const;

export type AdminNavIcon =
  | "dashboard"
  | "editions"
  | "banners"
  | "venues"
  | "catalog"
  | "registrations"
  | "promotions"
  | "social"
  | "sponsors"
  | "messages"
  | "settings"
  | "finance"
  | "integrations";

export type AdminNavItem = {
  label: string;
  href: (typeof adminRoutes)[keyof typeof adminRoutes];
  icon: AdminNavIcon;
  section: "main" | "system";
};

export const adminNavigation: readonly AdminNavItem[] = [
  { label: "Inicio", href: adminRoutes.dashboard, icon: "dashboard", section: "main" },
  { label: "Ediciones", href: adminRoutes.editions, icon: "editions", section: "main" },
  {
    label: "Banners del inicio",
    href: adminRoutes.homeBanners,
    icon: "banners",
    section: "main",
  },
  { label: "Sedes", href: adminRoutes.venues, icon: "venues", section: "main" },
  {
    label: "Productos y kits",
    href: adminRoutes.catalog,
    icon: "catalog",
    section: "main",
  },
  {
    label: "Inscripciones",
    href: adminRoutes.registrations,
    icon: "registrations",
    section: "main",
  },
  {
    label: "Códigos promocionales",
    href: adminRoutes.promotions,
    icon: "promotions",
    section: "main",
  },
  {
    label: "Publicaciones y comunicaciones",
    href: adminRoutes.social,
    icon: "social",
    section: "main",
  },
  {
    label: "Sponsors y beneficios",
    href: adminRoutes.sponsors,
    icon: "sponsors",
    section: "main",
  },
  { label: "Mensajes", href: adminRoutes.messages, icon: "messages", section: "main" },
  { label: "Configuración", href: adminRoutes.settings, icon: "settings", section: "system" },
  {
    /** Partner self-connect — no confundir con admin de % en la edición. */
    label: "Finanzas · mi cuenta de cobro",
    href: adminRoutes.financePartner,
    icon: "finance",
    section: "system",
  },
  {
    label: "Integraciones",
    href: adminRoutes.integrations,
    icon: "integrations",
    section: "system",
  },
] as const;

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === adminRoutes.dashboard) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
