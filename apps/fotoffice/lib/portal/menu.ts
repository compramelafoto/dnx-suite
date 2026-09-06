import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";

/**
 * El menú del socio, en un solo lugar.
 *
 * El orden y las rutas salen de `docs/fotoffice/ARQUITECTURA-NAVEGACION.md` §5, que es donde se
 * decide qué ve el socio y en qué orden. Este archivo es esa tabla hecha código: si las dos se
 * separan, el documento manda y hay que corregir acá.
 *
 * ── Por qué acá sí decimos "Próximamente" ──
 *
 * El documento tiene dos principios que lo prohíben (P1: un módulo apagado no existe; P2: el
 * menú nunca promete). Se escribieron para el panel administrativo, donde alguien trabaja todos
 * los días: ahí una lista de funciones que no andan es una lista de deudas que se relee cada
 * mañana.
 *
 * El portal es otra cosa. El socio entra cada tanto, y lo que ve tiene que contestarle qué le
 * da la institución a cambio de la cuota. Mostrar lo que viene no es una promesa incómoda: es
 * parte de la respuesta. Queda como excepción de esta superficie, no como cambio de los
 * principios.
 */

export type PortalMenuState =
  /** Tiene pantalla y el módulo está habilitado para esta institución. */
  | "DISPONIBLE"
  /** Está previsto y todavía no se puede usar. Se muestra apagado, con su aviso. */
  | "PROXIMAMENTE";

export type PortalMenuItem = {
  /** Orden del documento. No es el índice del arreglo: deja lugar para insertar en el medio. */
  order: number;
  label: string;
  href: string;
  /** Qué encuentra ahí, en una línea. Es lo que se lee en la portada. */
  description: string;
  icon: PortalIconName;
  /**
   * Módulo que tiene que estar habilitado en la institución. Sin esto, la sección depende solo
   * de que exista la pantalla.
   */
  requiresModule?: string;
  /** Si la pantalla ya existe. Lo que falta construir se muestra como "Próximamente". */
  built: boolean;
  /** Aparece en la barra inferior del teléfono. Como mucho cuatro: es lo que entra sin apretar. */
  primary?: boolean;
};

export type PortalIconName =
  | "home"
  | "card"
  | "wallet"
  | "user"
  | "gift"
  | "calendar"
  | "ticket"
  | "school"
  | "institution"
  | "share";

/** El mapa del §5 del documento de navegación, con su orden. */
export const PORTAL_MENU: PortalMenuItem[] = [
  {
    order: 10,
    label: "Inicio",
    href: "/portal",
    description: "Tu número, tu categoría y cómo viene tu cuenta.",
    icon: "home",
    built: true,
    primary: true,
  },
  {
    order: 20,
    label: "Mi carnet",
    href: "/portal/carnet",
    description: "Tu credencial con el código que verifica que sos socio.",
    icon: "card",
    built: true,
    primary: true,
  },
  {
    order: 30,
    label: "Mis cuotas",
    href: "/portal/cuotas",
    description: "Qué debés, qué pagaste y cómo pagar.",
    icon: "wallet",
    requiresModule: MEMBERSHIP_DUES_MODULE_KEY,
    built: true,
    primary: true,
  },
  {
    order: 40,
    label: "Mi perfil",
    href: "/portal/perfil",
    description: "Tu foto, a qué te dedicás y dónde se ve tu trabajo.",
    icon: "user",
    built: true,
    primary: true,
  },
  {
    order: 50,
    label: "Beneficios",
    href: "/portal/beneficios",
    description: "Descuentos y convenios con comercios y escuelas.",
    icon: "gift",
    built: false,
  },
  {
    order: 60,
    label: "Reservas",
    href: "/portal/reservas",
    description: "Reservar el salón, el estudio o el coworking.",
    icon: "calendar",
    requiresModule: "bookings",
    built: false,
  },
  {
    order: 70,
    label: "Sorteos",
    href: "/portal/sorteos",
    description: "El sorteo del mes y los resultados de los anteriores.",
    icon: "ticket",
    built: false,
  },
  {
    order: 80,
    label: "Cursos",
    href: "/portal/cursos",
    description: "Los cursos de la institución y cómo anotarte.",
    icon: "school",
    requiresModule: COURSES_SALES_MODULE_KEY,
    built: false,
  },
  {
    order: 90,
    label: "Institucional",
    href: "/portal/institucional",
    description: "Novedades, actas y en qué se usa la cuota.",
    icon: "institution",
    requiresModule: "governance",
    built: false,
  },
  {
    order: 100,
    label: "Mis referidos",
    href: "/portal/referidos",
    description: "A quién recomendaste y qué mes te bonificaron.",
    icon: "share",
    requiresModule: MEMBERS_MODULE_KEY,
    built: false,
  },
];

export type ResolvedPortalItem = PortalMenuItem & { state: PortalMenuState };

/**
 * El menú tal como lo ve esta persona en esta institución.
 *
 * Una sección está disponible cuando **las dos** cosas se cumplen: la pantalla existe y el
 * módulo está habilitado acá. Que exista la pantalla no alcanza — una institución sin Reservas
 * no debería poder entrar a reservar aunque el código esté escrito.
 *
 * Nada se oculta: lo que no está disponible se muestra como "Próximamente". Es la excepción del
 * portal explicada arriba.
 */
export function resolvePortalMenu(
  enabledModuleKeys: ReadonlySet<string>,
): ResolvedPortalItem[] {
  return [...PORTAL_MENU]
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      ...item,
      state:
        item.built && (!item.requiresModule || enabledModuleKeys.has(item.requiresModule))
          ? "DISPONIBLE"
          : "PROXIMAMENTE",
    }));
}

/** Las que van en la barra inferior del teléfono, ya resueltas. */
export function portalBottomBar(items: ResolvedPortalItem[]): ResolvedPortalItem[] {
  return items.filter((i) => i.primary).slice(0, 4);
}
