/**
 * Menú lateral del panel admin MVP — fuente única.
 */

export const adminRoutes = {
  dashboard: "/admin",
  editions: "/admin/ediciones",
  venues: "/admin/sedes",
  catalog: "/admin/catalogo",
  registrations: "/admin/inscripciones",
  sponsors: "/admin/sponsors",
  messages: "/admin/mensajes",
  settings: "/admin/configuracion",
  integrations: "/admin/integraciones",
  /** Compat: redirige al login unificado `/login`. */
  login: "/admin/login",
  unifiedLogin: "/login",
  forbidden: "/admin/acceso-denegado",
} as const;

export type AdminNavIcon =
  | "dashboard"
  | "editions"
  | "venues"
  | "catalog"
  | "registrations"
  | "sponsors"
  | "messages"
  | "settings"
  | "integrations";

export type AdminNavItem = {
  label: string;
  href: (typeof adminRoutes)[keyof typeof adminRoutes];
  icon: AdminNavIcon;
  section: "main" | "system";
};

export const adminNavigation: readonly AdminNavItem[] = [
  { label: "Dashboard", href: adminRoutes.dashboard, icon: "dashboard", section: "main" },
  { label: "Ediciones", href: adminRoutes.editions, icon: "editions", section: "main" },
  { label: "Sedes", href: adminRoutes.venues, icon: "venues", section: "main" },
  { label: "Catálogo", href: adminRoutes.catalog, icon: "catalog", section: "main" },
  {
    label: "Inscripciones",
    href: adminRoutes.registrations,
    icon: "registrations",
    section: "main",
  },
  { label: "Sponsors", href: adminRoutes.sponsors, icon: "sponsors", section: "main" },
  { label: "Mensajes", href: adminRoutes.messages, icon: "messages", section: "main" },
  { label: "Configuración", href: adminRoutes.settings, icon: "settings", section: "system" },
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
