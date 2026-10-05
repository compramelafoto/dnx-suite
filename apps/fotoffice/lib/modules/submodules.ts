import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { STORE_MODULE_KEY } from "@/lib/store/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";
import {
  BOOKINGS_CONFIGURE_ACTION,
  CASH_CONFIGURE_ACTION,
  COVERAGES_COORDINATE_ACTION,
  STORE_CONFIGURE_ACTION,
} from "@/lib/permissions/actions";
import { hasLevel, type ModuleLevels } from "@/lib/permissions/levels";
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
  /** Si hace falta gestionar (`MANAGE`) para verla; si no, alcanza con ver (`VIEW`). */
  requiresManage: boolean;
  /**
   * El módulo cuyo nivel decide esta pantalla, cuando no es el del grupo donde se muestra.
   * Cuotas vive en el menú de Socios pero su permiso es el de `membership-dues`: una Tesorería
   * puede cobrar sin gestionar el padrón, y una Secretaría al revés.
   */
  levelModuleKey?: string;
  /** Acción sensible (ver `lib/permissions/actions.ts`) que además hace falta tener. */
  requiresAction?: string;
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
    requiresManage: false,
    levelModuleKey: MEMBERSHIP_DUES_MODULE_KEY,
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
    levelModuleKey: MEMBERSHIP_DUES_MODULE_KEY,
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
    requiresAction: BOOKINGS_CONFIGURE_ACTION,
    activeMatch: "under",
  },
  {
    href: "/reservas/extras",
    label: "Extras",
    icon: "PackagePlus",
    description: "El equipamiento que se alquila junto con un espacio, y cuánto hay de cada cosa.",
    requiresManage: true,
    requiresAction: BOOKINGS_CONFIGURE_ACTION,
    activeMatch: "under",
  },
  {
    href: "/reservas/configuracion",
    label: "Tarifas y reglas",
    icon: "CalendarClock",
    description: "Plazos de pago, cancelación y cierres por feriado.",
    requiresManage: true,
    requiresAction: BOOKINGS_CONFIGURE_ACTION,
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

const GOBIERNO: SubmoduleItem[] = [
  {
    href: "/gobierno",
    label: "Proyectos",
    icon: "FolderKanban",
    description: "Cada proyecto con sus etapas, tareas, archivos e historial, ordenados por urgencia.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/gobierno/tareas",
    label: "Tareas",
    icon: "ListTodo",
    description: "Todas las tareas delegadas: quién tiene qué, para cuándo y qué está vencido.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/gobierno/tipos",
    label: "Tipos de proyecto",
    icon: "LayoutTemplate",
    description: "Las plantillas de etapas y tareas con que arranca cada proyecto nuevo.",
    requiresManage: true,
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
    requiresAction: CASH_CONFIGURE_ACTION,
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
    requiresManage: true,
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
    requiresAction: COVERAGES_COORDINATE_ACTION,
    activeMatch: "under",
  },
  {
    href: "/coberturas/configuracion",
    label: "Configuración",
    icon: "Settings",
    description: "Las palabras, los plazos y quién decide en esta organización.",
    requiresManage: true,
    requiresAction: COVERAGES_COORDINATE_ACTION,
    activeMatch: "under",
  },
];

const VENTAS: SubmoduleItem[] = [
  {
    href: "/ventas",
    label: "Mostrador",
    icon: "ShoppingCart",
    description: "Buscá, sumá al ticket y cobrá.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/ventas/catalogo",
    label: "Catálogo",
    icon: "Package",
    description: "Los productos y servicios, con su precio, su costo y su foto.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/ventas/stock",
    label: "Stock",
    icon: "Boxes",
    description: "Qué queda, qué entró y qué hay que reponer.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/ventas/historial",
    label: "Ventas hechas",
    icon: "ReceiptText",
    description: "Lo vendido, con su detalle y su anulación.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    // Decide el nivel en `store` (con la tienda apagada es NONE y no aparece). Operar los
    // pedidos alcanza con gestionar la tienda; no hace falta poder configurarla.
    href: "/ventas/tienda",
    label: "Pedidos online",
    icon: "PackageCheck",
    description: "Los pedidos de la tienda online: preparar, entregar, cancelar y resolver problemas.",
    requiresManage: true,
    levelModuleKey: STORE_MODULE_KEY,
    activeMatch: "under",
  },
  {
    // Decide el nivel en `store`, que ya incluye si la tienda está encendida para el
    // workspace: con el módulo apagado el nivel es NONE y la entrada no aparece.
    href: "/ventas/tienda/configuracion",
    label: "Tienda",
    icon: "Store",
    description: "Abrir o cerrar la tienda online, el retiro, la política de devoluciones y los avisos.",
    requiresManage: true,
    levelModuleKey: STORE_MODULE_KEY,
    requiresAction: STORE_CONFIGURE_ACTION,
    activeMatch: "under",
  },
  {
    // Mismo permiso que la configuración de la tienda (`requireStoreConfigurer`).
    href: "/ventas/tienda/envios",
    label: "Envíos",
    icon: "Truck",
    description: "Retiro, envío a domicilio y a sucursal: precios por zona, Correo Argentino y recargo.",
    requiresManage: true,
    levelModuleKey: STORE_MODULE_KEY,
    requiresAction: STORE_CONFIGURE_ACTION,
    activeMatch: "under",
  },
];

const COMUNICACION: SubmoduleItem[] = [
  {
    href: "/comunicacion/placas",
    label: "Bienvenidas",
    icon: "PartyPopper",
    description: "La placa de bienvenida de cada {persona} nuevo, lista para descargar y publicar.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/comunicacion/placas/socio-de-la-semana",
    label: "Socio de la semana",
    icon: "Star",
    description: "El {persona} destacado de cada viernes, con su placa y su texto para redes.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/comunicacion/fechas",
    label: "Fechas y saludos",
    icon: "CalendarDays",
    description: "Cumpleaños, aniversarios de ingreso, fiestas, fechas patrias y días del oficio: cada saludo por correo, con su interruptor.",
    requiresManage: true,
    activeMatch: "under",
  },
  {
    href: "/comunicacion/correo",
    label: "Correo",
    icon: "Mail",
    description: "Los correos a los {personas}: interruptores, resumen semanal del blog e historial de envíos.",
    requiresManage: true,
    activeMatch: "under",
  },
  {
    href: "/comunicacion/plantillas",
    label: "Plantillas",
    icon: "Palette",
    description: "El diseño de las placas, con el mismo diseñador del carnet.",
    requiresManage: true,
    activeMatch: "under",
  },
];

const POR_MODULO: Record<string, SubmoduleItem[]> = {
  [MEMBERS_MODULE_KEY]: SOCIOS,
  [COURSES_SALES_MODULE_KEY]: CURSOS,
  [BOOKINGS_MODULE_KEY]: RESERVAS,
  [RAFFLES_MODULE_KEY]: SORTEOS,
  [GOVERNANCE_MODULE_KEY]: GOBIERNO,
  [CASH_MODULE_KEY]: CAJA,
  [CLIENTS_MODULE_KEY]: CLIENTES,
  [COVERAGES_MODULE_KEY]: COBERTURAS,
  [SALES_MODULE_KEY]: VENTAS,
  [COMMUNICATIONS_MODULE_KEY]: COMUNICACION,
};

/**
 * Lo que sabe el menú de quien mira: su nivel en cada módulo (`getModuleLevels`) y las acciones
 * sensibles vigentes que alguna pantalla exige, calculadas en el servidor con `hasModuleAction`.
 * Es serializable a propósito: viaja del servidor al menú, que es un componente de cliente.
 */
export type SubmoduleAccess = { levels: ModuleLevels; actions: readonly string[] };

function puedeAbrir(moduleKey: string, item: SubmoduleItem, access: SubmoduleAccess): boolean {
  const nivel = (key: string) => access.levels[key] ?? "NONE";
  // Todo el grupo cuelga del layout de su módulo, que exige al menos verlo.
  if (!hasLevel(nivel(moduleKey), "VIEW")) return false;
  const decide = item.levelModuleKey ?? moduleKey;
  if (!hasLevel(nivel(decide), item.requiresManage ? "MANAGE" : "VIEW")) return false;
  if (item.requiresAction && !access.actions.includes(item.requiresAction)) return false;
  return true;
}

/**
 * Las pantallas de un módulo que esta persona puede abrir, con la misma regla que sus páginas.
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
  access: SubmoduleAccess,
  vocabulary: PersonVocabulary,
): SubmoduleItem[] {
  const items = POR_MODULO[moduleKey];
  if (!items) return [];
  return items
    .filter((i) => puedeAbrir(moduleKey, i, access))
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
