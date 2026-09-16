import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";

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
    description: "Todos los {personas}, su estado y su ficha.",
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

const RESERVAS: SubmoduleItem[] = [
  {
    href: "/reservas",
    label: "Agenda",
    icon: "CalendarDays",
    description: "Quién ocupa qué espacio esta semana, y carga de reservas por teléfono.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/reservas/espacios",
    label: "Espacios",
    icon: "DoorOpen",
    description: "Qué se alquila, cuándo, a qué precio y con qué otros espacios puede convivir.",
    requiresManage: true,
    activeMatch: "under",
  },
  {
    href: "/reservas/extras",
    label: "Extras",
    icon: "PackagePlus",
    description: "El equipamiento que se alquila junto con un espacio, y cuánto hay de cada cosa.",
    requiresManage: true,
    activeMatch: "under",
  },
  {
    href: "/reservas/configuracion",
    label: "Tarifas y reglas",
    icon: "CalendarClock",
    description: "Plazos de pago, cancelación y cierres por feriado.",
    requiresManage: true,
    activeMatch: "under",
  },
];

const SORTEOS: SubmoduleItem[] = [
  {
    href: "/sorteos",
    label: "Sorteos",
    icon: "Ticket",
    description: "Los sorteos entre {personas} al día, con premios de las marcas aliadas.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/sorteos/entregas",
    label: "Entregas",
    icon: "PackageCheck",
    description: "Los premios ganados que todavía hay que avisar o entregar.",
    requiresManage: false,
    activeMatch: "under",
  },
];

const CAJA: SubmoduleItem[] = [
  {
    href: "/caja",
    label: "Panorama",
    icon: "Wallet",
    description: "El saldo de cada cuenta, lo último que entró y salió, y el turno de cada mostrador.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/caja/movimientos",
    label: "Movimientos",
    icon: "ArrowLeftRight",
    description: "El libro completo, con filtros por fecha, cuenta y categoría.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/caja/reportes",
    label: "Reportes",
    icon: "BarChart3",
    description: "Saldo por cuenta, ingresos y egresos por categoría y los clientes que más compraron.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/caja/turnos",
    label: "Arqueos",
    icon: "ClipboardCheck",
    description: "Cada apertura y cierre, con su diferencia y su explicación.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/caja/pases",
    label: "Pases entre cuentas",
    icon: "CreditCard",
    description: "Cada pase de una cuenta a otra, como el de mostrador a caja fuerte.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/caja/configuracion",
    label: "Cuentas y categorías",
    icon: "Settings",
    description: "Dónde está la plata y cómo se clasifica lo que entra y sale.",
    requiresManage: true,
    activeMatch: "under",
  },
];

const CLIENTES: SubmoduleItem[] = [
  {
    href: "/clientes",
    label: "Padrón",
    icon: "Users",
    description: "Todos los clientes, su ficha y su historial de consumo.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/clientes/nuevo",
    label: "Nuevo cliente",
    icon: "UserPlus",
    description: "Dar de alta a alguien que compra por primera vez.",
    requiresManage: false,
    activeMatch: "under",
  },
];

const COBERTURAS: SubmoduleItem[] = [
  {
    href: "/coberturas",
    label: "Solicitudes",
    icon: "Inbox",
    description: "Los pedidos que llegaron y en qué anda cada uno.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/coberturas/colaboradores",
    label: "Colaboradores",
    icon: "UserCheck",
    description: "Quiénes del padrón están habilitados para anotarse a una convocatoria.",
    requiresManage: true,
    activeMatch: "under",
  },
  {
    href: "/coberturas/configuracion",
    label: "Configuración",
    icon: "Settings",
    description: "Las palabras, los plazos y quién decide en esta organización.",
    requiresManage: true,
    activeMatch: "under",
  },
];

const POR_MODULO: Record<string, SubmoduleItem[]> = {
  [MEMBERS_MODULE_KEY]: SOCIOS,
  [COURSES_SALES_MODULE_KEY]: CURSOS,
  [BOOKINGS_MODULE_KEY]: RESERVAS,
  [RAFFLES_MODULE_KEY]: SORTEOS,
  [CASH_MODULE_KEY]: CAJA,
  [CLIENTS_MODULE_KEY]: CLIENTES,
  [COVERAGES_MODULE_KEY]: COBERTURAS,
};

/**
 * Las pantallas de un módulo que esta persona puede abrir.
 *
 * Devuelve vacío para un módulo de una sola pantalla o desconocido, y quien llama decide qué
 * hacer con eso — no se inventa una lista.
 *
 * `vocabulary` resuelve los marcadores ({persona}, {personas}, etc.) del bloque `SOCIOS`, que
 * este catálogo deja sin resolver a propósito por ser global. Un workspace real pasa
 * `loadPersonVocabulary(id)`; una pantalla sin workspace pasa `personVocabulary(null)`.
 */
export function submodulesFor(
  moduleKey: string,
  opts: { canManage: boolean },
  vocabulary: PersonVocabulary,
): SubmoduleItem[] {
  const items = POR_MODULO[moduleKey];
  if (!items) return [];
  return items
    .filter((i) => !i.requiresManage || opts.canManage)
    .map((i) => ({
      ...i,
      label: aplicarVocabulario(i.label, vocabulary),
      description: aplicarVocabulario(i.description, vocabulary),
    }));
}

/** Las rutas que reclama una entrada propia. Sirve para resolver `activeMatch: "rest"`. */
export function claimedPrefixes(moduleKey: string): string[] {
  const items = POR_MODULO[moduleKey] ?? [];
  const raiz = items.find((i) => i.activeMatch === "rest")?.href;
  return items.filter((i) => i.href !== raiz).map((i) => i.href);
}

/**
 * Todas las pantallas declaradas, de todos los módulos, sin filtrar por permiso.
 *
 * Existe para pruebas que necesitan barrer el catálogo entero (por ejemplo, validar que cada
 * `icon` nombrado acá exista de verdad en el mapa que usa el menú) sin tener que enumerar las
 * claves de módulo a mano y quedar desactualizadas el día que se agregue una nueva.
 */
export function allSubmoduleItems(): SubmoduleItem[] {
  return Object.values(POR_MODULO).flat();
}
