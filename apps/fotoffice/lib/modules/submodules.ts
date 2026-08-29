import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";

/**
 * Las pantallas de cada módulo, en un solo lugar.
 *
 * Existe porque el menú lateral y el inicio del workspace tenían cada uno su propia lista, y
 * se desincronizaron: el Diseñador de plantillas aparecía en el menú del módulo Socios pero el
 * inicio no lo mencionaba, así que desde la pantalla principal no había forma de enterarse de
 * que existía. Con una sola fuente eso no puede volver a pasar.
 *
 * No incluye los módulos de una sola pantalla —Sitio web— porque ahí la tarjeta del módulo ya
 * lleva al único lugar al que se puede ir.
 */

export type ActiveMatch =
  /** Activo en esa ruta y en todo lo que cuelgue de ella. */
  | "under"
  /** Activo solo en esa ruta exacta. Para cuando una hija tiene su propia entrada. */
  | "exact"
  /** Activo en el resto del módulo: lo que no reclama ninguna otra entrada. */
  | "rest";

export type SubmoduleItem = {
  href: string;
  label: string;
  /** Nombre del ícono de lucide. El menú lo resuelve; el inicio no dibuja íconos. */
  icon: string;
  /** Qué se hace ahí, en una línea. Solo lo usa el inicio. */
  description: string;
  /** Si hace falta permiso de administración del módulo para verla. */
  requiresManage: boolean;
  activeMatch: ActiveMatch;
};

const SOCIOS: SubmoduleItem[] = [
  {
    href: "/members",
    label: "Padrón",
    icon: "Users",
    description: "Todos los socios, su estado y su ficha.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/members/solicitudes",
    label: "Solicitudes",
    icon: "Inbox",
    description: "Quienes pidieron asociarse y esperan resolución.",
    requiresManage: true,
    activeMatch: "under",
  },
  {
    href: "/members/cuotas",
    label: "Cuotas",
    icon: "Wallet",
    description: "Qué se debe, qué se cobró y qué se generó.",
    requiresManage: true,
    activeMatch: "exact",
  },
  {
    href: "/members/carnets",
    label: "Carnets",
    icon: "CreditCard",
    description: "Emisión de credenciales y pedidos de impresión.",
    requiresManage: true,
    activeMatch: "under",
  },
  {
    href: "/members/disenador",
    label: "Diseñador",
    icon: "Palette",
    description: "Diseñá el carnet y las placas con tus propios datos variables.",
    requiresManage: true,
    activeMatch: "under",
  },
  {
    href: "/members/categories",
    label: "Categorías",
    icon: "Tag",
    description: "Profesional, estudiante, honorario y las que definas.",
    requiresManage: true,
    activeMatch: "under",
  },
  {
    href: "/members/cuotas/configuracion",
    label: "Valores y calendario",
    icon: "CalendarClock",
    description: "Cuánto vale la cuota y cuándo vence.",
    requiresManage: true,
    activeMatch: "under",
  },
];

const CURSOS: SubmoduleItem[] = [
  {
    href: "/dashboard/courses",
    label: "Cursos",
    icon: "GraduationCap",
    description: "Los cursos publicados y sus ediciones.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/dashboard/sales",
    label: "Ventas",
    icon: "LayoutGrid",
    description: "Lo vendido y su estado de cobro.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/courses/teachers",
    label: "Docentes",
    icon: "Users",
    description: "Quiénes dictan y en qué cursos.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/courses/leads",
    label: "Inscripciones",
    icon: "Inbox",
    description: "Quienes se anotaron y hay que contactar.",
    requiresManage: false,
    activeMatch: "under",
  },
];

const POR_MODULO: Record<string, SubmoduleItem[]> = {
  [MEMBERS_MODULE_KEY]: SOCIOS,
  [COURSES_SALES_MODULE_KEY]: CURSOS,
};

/**
 * Las pantallas de un módulo que esta persona puede abrir.
 *
 * Devuelve vacío para un módulo de una sola pantalla o desconocido, y quien llama decide qué
 * hacer con eso — no se inventa una lista.
 */
export function submodulesFor(
  moduleKey: string,
  opts: { canManage: boolean },
): SubmoduleItem[] {
  const items = POR_MODULO[moduleKey];
  if (!items) return [];
  return items.filter((i) => !i.requiresManage || opts.canManage);
}

/** Las rutas que reclama una entrada propia. Sirve para resolver `activeMatch: "rest"`. */
export function claimedPrefixes(moduleKey: string): string[] {
  const items = POR_MODULO[moduleKey] ?? [];
  const raiz = items.find((i) => i.activeMatch === "rest")?.href;
  return items.filter((i) => i.href !== raiz).map((i) => i.href);
}
