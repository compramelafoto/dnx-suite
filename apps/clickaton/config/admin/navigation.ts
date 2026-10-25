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
  /** Una fila por persona: todas sus inscripciones, fotos, notas y ciudad. */
  people: "/admin/personas",
  promotions: "/admin/promociones",
  /** Fotógrafos dueños de códigos con comisión. */
  affiliates: "/admin/afiliados",
  /** Comisiones de los códigos de fotógrafo: cobradas, a transferir, transferidas. */
  commissions: "/admin/comisiones",
  social: "/admin/social",
  sponsors: "/admin/sponsors",
  /** Qué lugares del inventario publicitario están tomados. */
  sponsorsInventory: "/admin/sponsors/inventario",
  /** Quién puede vender inventario, y hasta dónde. */
  sponsorsSellers: "/admin/sponsors/vendedores",
  templates: "/admin/plantillas",
  /** CMS del blog público (`@repo/content`, platform = clickaton). */
  contents: "/admin/contenidos",
  messages: "/admin/mensajes",
  /** Encuesta de satisfacción y moderación de testimonios públicos. */
  testimonials: "/admin/testimonios",
  clickatoner: "/admin/clickatoner",
  /** Programa "invitá a tus amigos": quién trajo a quién, y el envío del link. */
  referrals: "/admin/referidos",
  settings: "/admin/configuracion",
  financeOwner: "/admin/finanzas/cuenta-owner",
  editionResults: "/admin/finanzas/ediciones",
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
  | "contents"
  | "messages"
  | "settings"
  | "finance"
  | "integrations";

export type AdminNavItem = {
  label: string;
  href: (typeof adminRoutes)[keyof typeof adminRoutes];
  icon: AdminNavIcon;
  section: "main" | "system";
  /** Qué se hace ahí, en una línea. La usa el buscador del menú (⌘K). */
  description?: string;
};

export const adminNavigation: readonly AdminNavItem[] = [
  {
    label: "Inicio",
    href: adminRoutes.dashboard,
    icon: "dashboard",
    section: "main",
    description: "Resumen del panel: lo que pasa hoy y lo que falta",
  },
  {
    label: "Ediciones",
    href: adminRoutes.editions,
    icon: "editions",
    section: "main",
    description: "Crear y configurar cada maratón: fechas, consignas, jurados y precios",
  },
  {
    label: "Plantillas",
    href: adminRoutes.templates,
    icon: "sponsors",
    section: "main",
    description: "Diseñar las piezas gráficas que después usan las placas de cada edición",
  },
  {
    label: "Banners del inicio",
    href: adminRoutes.homeBanners,
    icon: "banners",
    section: "main",
    description: "Las imágenes destacadas de la portada del sitio",
  },
  {
    label: "Sedes",
    href: adminRoutes.venues,
    icon: "venues",
    section: "main",
    description: "Los lugares de cada edición",
  },
  {
    label: "Productos y kits",
    href: adminRoutes.catalog,
    icon: "catalog",
    section: "main",
    description: "Kits, remeras y productos que se venden con la inscripción",
  },
  {
    label: "Inscripciones",
    href: adminRoutes.registrations,
    icon: "registrations",
    section: "main",
    description: "Quién se anotó, qué pagó y en qué estado está cada inscripción",
  },
  {
    label: "Personas",
    href: adminRoutes.people,
    icon: "registrations",
    section: "main",
    description: "Una ficha por persona con todas sus inscripciones, fotos y notas",
  },
  {
    label: "Códigos promocionales",
    href: adminRoutes.promotions,
    icon: "promotions",
    section: "main",
    description: "Cupones de descuento y regalos de inscripción",
  },
  {
    label: "Fotógrafos con código",
    href: adminRoutes.affiliates,
    icon: "promotions",
    section: "main",
    description: "Fotógrafos dueños de un código que cobra comisión",
  },
  {
    label: "Comisiones de fotógrafos",
    href: adminRoutes.commissions,
    icon: "finance",
    section: "main",
    description: "Comisiones cobradas, a transferir y transferidas",
  },
  {
    label: "Publicaciones y comunicaciones",
    href: adminRoutes.social,
    icon: "social",
    section: "main",
    description: "Posteos en redes y avisos a los participantes",
  },
  {
    label: "Sponsors y beneficios",
    href: adminRoutes.sponsors,
    icon: "sponsors",
    section: "main",
    description: "Auspiciantes, sus logos y los beneficios que ofrecen",
  },
  {
    label: "Ocupación del inventario",
    href: adminRoutes.sponsorsInventory,
    icon: "sponsors",
    section: "main",
    description: "Qué lugares publicitarios están tomados y cuáles libres",
  },
  {
    label: "Vendedores habilitados",
    href: adminRoutes.sponsorsSellers,
    icon: "sponsors",
    section: "main",
    description: "Quién puede vender espacios de sponsors y hasta dónde",
  },
  {
    label: "Contenidos",
    href: adminRoutes.contents,
    icon: "contents",
    section: "main",
    description: "Notas del blog público de Clickatón",
  },
  {
    label: "Números por edición",
    href: adminRoutes.editionResults,
    icon: "finance",
    section: "main",
    description: "Ingresos, costos y resultado de cada edición",
  },
  {
    label: "Mensajes",
    href: adminRoutes.messages,
    icon: "messages",
    section: "main",
    description: "Consultas del formulario de contacto y de Formá parte",
  },
  {
    label: "Testimonios y calidad",
    href: adminRoutes.testimonials,
    icon: "messages",
    section: "main",
    description: "Encuesta de satisfacción y testimonios para publicar",
  },
  {
    label: "Clickatoner de la semana",
    href: adminRoutes.clickatoner,
    icon: "social",
    section: "main",
    description: "El participante destacado de cada semana",
  },
  {
    label: "Invitá a tus amigos",
    href: adminRoutes.referrals,
    icon: "promotions",
    section: "main",
    description: "Quién trajo a quién con su link de referido",
  },
  {
    label: "Configuración",
    href: adminRoutes.settings,
    icon: "settings",
    section: "system",
    description: "Datos generales del panel administrativo",
  },
  {
    /** Partner self-connect — no confundir con admin de % en la edición. */
    label: "Finanzas · mi cuenta de cobro",
    href: adminRoutes.financePartner,
    icon: "finance",
    section: "system",
    description: "Conectar tu cuenta de Mercado Pago para cobrar tu parte",
  },
  {
    label: "Integraciones",
    href: adminRoutes.integrations,
    icon: "integrations",
    section: "system",
    description: "Con qué sistemas trabaja Clickatón y en qué estado está cada uno",
  },
] as const;

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === adminRoutes.dashboard) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
