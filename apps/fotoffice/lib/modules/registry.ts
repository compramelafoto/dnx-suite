import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { SPONSORS_MODULE_KEY } from "@/lib/sponsors/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { STORE_MODULE_KEY } from "@/lib/store/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";

/**
 * Catálogo central de módulos de FotoOffice.
 *
 * Esta es la única fuente de verdad de qué módulos EXISTEN en la plataforma
 * (metadata: nombre, descripción, categoría). No confundir con
 * `WorkspaceFeatureModule` (en `packages/db`), que es la fuente de verdad de
 * qué módulos tiene HABILITADOS cada Workspace puntual.
 *
 * Registrar un módulo acá con status "AVAILABLE" lo hace aparecer
 * automáticamente en el panel de administración de módulos, sin tocar
 * ningún otro archivo.
 */

export type ModuleCategory = "GENERAL" | "INSTITUTIONAL";

/**
 * AVAILABLE: implementado y usable — tiene pantalla real y puede
 *   activarse/desactivarse por workspace de verdad.
 * PLANNED: key reservada para una etapa futura. Aparece en el catálogo
 *   (documentación/roadmap) pero NUNCA se ofrece como toggle real ni
 *   aparece en el sidebar — evita "llenar el menú" con módulos que
 *   todavía no existen.
 */
export type ModuleStatus = "AVAILABLE" | "PLANNED";

export type ModuleFamily = "base" | "negocio" | "institucion" | "coberturas" | "formacion" | "espacios";

export const FAMILY_LABELS: Record<ModuleFamily, string> = {
  base: "Base",
  negocio: "Negocio fotográfico",
  institucion: "Institución",
  coberturas: "Coberturas y voluntariado",
  formacion: "Formación",
  espacios: "Espacios",
};

export type ModuleDefinition = {
  /** Clave técnica y estable. Es el mismo valor que `WorkspaceFeatureModule.moduleKey`. */
  key: string;
  label: string;
  description: string;
  category: ModuleCategory;
  /** Orden de presentación dentro de su categoría (ascendente). */
  order: number;
  /** Ruta principal del módulo, si ya tiene pantalla implementada. */
  route?: string;
  status: ModuleStatus;
  /** Familia en la que se agrupa en la pantalla de Módulos. */
  family: ModuleFamily;
  /** Claves de módulos que deben estar encendidos para que este funcione. */
  dependsOn?: string[];
  /** Módulo con comisión de plataforma: no se enciende solo, se pide la activación. */
  platformFee?: boolean;
};

export const MODULE_REGISTRY: readonly ModuleDefinition[] = [
  // --- Módulos reales, implementados hoy ---
  {
    key: COURSES_SALES_MODULE_KEY,
    label: "Cursos presenciales",
    description:
      "Venta y gestión de cursos presenciales: docentes, cupos, inscripción y cobro por Mercado Pago.",
    category: "GENERAL",
    order: 10,
    route: "/dashboard/courses",
    status: "AVAILABLE",
    family: "formacion",
    platformFee: true,
  },
  {
    key: EVALUACIONES_MODULE_KEY,
    label: "Evaluaciones",
    description: "Evaluaciones asociadas a los cursos del workspace.",
    category: "GENERAL",
    order: 20,
    route: "/evaluaciones",
    status: "AVAILABLE",
    family: "formacion",
    dependsOn: ["courses-sales"],
  },
  {
    key: SERVICE_LEADS_MODULE_KEY,
    label: "Consultas de presupuesto",
    description:
      "Formularios públicos para pedir presupuesto y la bandeja donde llegan esas consultas.",
    category: "GENERAL",
    order: 24,
    route: "/consultas",
    status: "AVAILABLE",
    family: "negocio",
  },
  {
    // Etapa 2 (Entrega A): presupuestos de las consultas, con enlace público y aceptación. Los
    // presupuestos cuelgan de una consulta, por eso depende de Consultas. Lo enciende el
    // administrador de la plataforma, como el resto (la pantalla de Módulos no cambia).
    key: "quotes",
    label: "Presupuestos",
    description:
      "Presupuestos de las consultas con productos del catálogo o calculados con ¿Cuánto Cobro?, enlace para el cliente y aceptación en línea.",
    category: "GENERAL",
    order: 26,
    route: "/presupuestos",
    status: "AVAILABLE",
    family: "negocio",
    dependsOn: [SERVICE_LEADS_MODULE_KEY],
  },
  {
    key: WEBSITE_MODULE_KEY,
    label: "Sitio web",
    description: "Sitio público del workspace: portada, secciones y datos de publicación.",
    category: "GENERAL",
    order: 25,
    route: "/website",
    status: "AVAILABLE",
    family: "base",
  },
  {
    key: BOOKINGS_MODULE_KEY,
    label: "Reservas",
    description:
      "Reserva de salón, estudio, coworking u otros espacios: horarios, tarifas para {personas} y no {personas}, extras y agenda.",
    category: "GENERAL",
    order: 60,
    route: "/reservas",
    status: "AVAILABLE",
    family: "espacios",
    platformFee: true,
  },
  {
    key: COVERAGES_MODULE_KEY,
    label: "Solicitudes y Coberturas",
    description:
      "Pedidos de cobertura fotográfica: evaluación, convocatoria de colaboradores, asignación del equipo y control de entregas.",
    category: "GENERAL",
    order: 65,
    route: "/coberturas",
    status: "AVAILABLE",
    family: "coberturas",
  },

  // --- Reservados para etapas futuras. Claves fijadas, SIN implementar. ---
  {
    key: CASH_MODULE_KEY,
    label: "Caja",
    description:
      "Ingresos y egresos del negocio, con cuentas separadas, arqueo por turno y reportes por período.",
    category: "GENERAL",
    order: 30,
    route: "/caja",
    status: "AVAILABLE",
    family: "base",
  },
  {
    key: SALES_MODULE_KEY,
    label: "Ventas",
    description:
      "Catálogo de productos y servicios con stock, y una pantalla de mostrador que cobra y deposita en Caja.",
    category: "GENERAL",
    order: 35,
    route: "/ventas",
    status: "AVAILABLE",
    family: "negocio",
  },
  {
    // Que la tienda necesita Ventas (vende el mismo catálogo y el mismo stock) lo hace cumplir
    // `lib/store/access.ts`, y que necesita el Sitio web para verse lo resuelve el sitio
    // público, que sin él no existe. `dependsOn` sólo lo usa la pantalla de Módulos para avisar.
    // Sin `route` a propósito: no es una entrada más del menú lateral, sus pantallas cuelgan
    // del submenú de Ventas (`lib/modules/submodules.ts`).
    key: STORE_MODULE_KEY,
    label: "Tienda online",
    description:
      "Los productos del catálogo de Ventas a la venta en el sitio público, con cobro por Mercado Pago y retiro en el local. Necesita Ventas y el Sitio web encendidos.",
    category: "GENERAL",
    order: 36,
    status: "AVAILABLE",
    family: "negocio",
    dependsOn: [SALES_MODULE_KEY, WEBSITE_MODULE_KEY],
  },
  {
    key: COMMUNICATIONS_MODULE_KEY,
    label: "Comunicación",
    description:
      "Placas para redes: la bienvenida a cada {persona} nuevo y el {persona} de la semana, con plantillas que diseña la institución.",
    category: "GENERAL",
    order: 40,
    route: "/comunicacion/placas",
    status: "AVAILABLE",
    family: "base",
  },
  {
    key: "events",
    label: "Eventos",
    description: "Eventos con inscripción y asistencia.",
    category: "GENERAL",
    order: 50,
    status: "PLANNED",
    family: "institucion",
  },
  {
    key: CLIENTS_MODULE_KEY,
    label: "Clientes",
    description:
      "Padrón de clientes del negocio: ficha, contacto, datos fiscales y enlace opcional al {persona}.",
    category: "GENERAL",
    order: 70,
    route: "/clientes",
    status: "AVAILABLE",
    family: "base",
  },
  {
    key: MEMBERS_MODULE_KEY,
    label: "{Personas}",
    description: "Padrón de {personas} de una institución: alta, edición, categorías y estado.",
    category: "INSTITUTIONAL",
    order: 100,
    route: "/members",
    status: "AVAILABLE",
    family: "institucion",
  },
  {
    key: MEMBERSHIP_DUES_MODULE_KEY,
    label: "Cuotas societarias",
    description:
      "Cuotas periódicas de los {personas}: generación mensual, cobro por Mercado Pago, pagos a mano e historial.",
    category: "INSTITUTIONAL",
    order: 110,
    route: "/members/cuotas",
    status: "AVAILABLE",
    family: "institucion",
    dependsOn: ["members"],
    platformFee: true,
  },
  {
    key: RAFFLES_MODULE_KEY,
    label: "Sorteos",
    description:
      "Sorteos entre {personas} al día, con premios donados por marcas aliadas y un resultado que cualquiera puede comprobar.",
    category: "INSTITUTIONAL",
    order: 115,
    route: "/sorteos",
    status: "AVAILABLE",
    family: "institucion",
  },
  {
    key: SPONSORS_MODULE_KEY,
    label: "Sponsors",
    description:
      "Las marcas que acompañan a la institución: su ficha en la base común de DNX y en qué lugar del sitio y del portal de los {personas} aparece cada una, y hasta cuándo.",
    category: "INSTITUTIONAL",
    order: 116,
    route: "/sponsors",
    status: "AVAILABLE",
    family: "institucion",
  },
  {
    key: PORTFOLIO_MODULE_KEY,
    label: "Portfolios",
    description:
      "Cada una de las {personas} arma su galería y la publica en el sitio de la institución, con su obra, su presentación y su contacto.",
    category: "INSTITUTIONAL",
    order: 118,
    route: "/portfolios",
    status: "AVAILABLE",
    family: "institucion",
  },
  {
    key: GOVERNANCE_MODULE_KEY,
    label: "Proyectos de la comisión",
    description:
      "Los proyectos de la comisión directiva: etapas, tareas delegadas con responsable y fecha, archivos e historial de todo lo que pasó.",
    category: "INSTITUTIONAL",
    order: 120,
    route: "/gobierno",
    status: "AVAILABLE",
    family: "institucion",
  },
  {
    key: "exhibitions",
    label: "Muestras",
    description: "Muestras institucionales.",
    category: "INSTITUTIONAL",
    order: 130,
    status: "PLANNED",
    family: "institucion",
  },
  {
    key: "transparency",
    label: "Transparencia",
    description: "Publicación de balances y rendiciones institucionales.",
    category: "INSTITUTIONAL",
    order: 140,
    status: "PLANNED",
    family: "institucion",
  },
  {
    // Etapa 3 (Entrega A): el pedido nace de un presupuesto aceptado (o a mano desde un contacto),
    // con su plan de cuotas, cobros y recibos. Por eso depende de Presupuestos.
    key: "orders",
    label: "Pedidos",
    description:
      "Pedidos confirmados desde un presupuesto aceptado o cargados a mano, con plan de cuotas, cobros que van a Caja y recibos.",
    category: "GENERAL",
    order: 27,
    route: "/pedidos",
    status: "AVAILABLE",
    family: "negocio",
    dependsOn: ["quotes"],
  },
  {
    key: "projects",
    label: "Proyectos",
    description: "Proyectos fotográficos con sus tareas, fechas y equipo.",
    category: "GENERAL",
    order: 28,
    status: "AVAILABLE",
    route: "/proyectos",
    family: "negocio",
    dependsOn: ["orders"],
  },
  {
    key: "gallery",
    label: "Galería",
    description: "Galerías para entregar y mostrar las fotos de cada proyecto.",
    category: "GENERAL",
    order: 29,
    status: "PLANNED",
    family: "negocio",
    dependsOn: ["projects"],
  },
  {
    key: "agenda",
    label: "Agenda",
    description: "Agenda de citas del equipo, con las entregas, tareas y vencimientos del negocio en un solo calendario.",
    category: "GENERAL",
    order: 35,
    status: "AVAILABLE",
    route: "/agenda",
    family: "base",
  },
  {
    key: "contracts",
    label: "Contratos",
    description: "Contratos de los pedidos: se arman con una plantilla, se mandan a firmar por correo y quedan firmados con firma electrónica.",
    category: "GENERAL",
    order: 36,
    status: "AVAILABLE",
    route: "/contratos",
    family: "negocio",
    dependsOn: ["orders"],
  },
] as const;

export function getModuleDefinition(key: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((m) => m.key === key);
}

export function listModules(options?: {
  status?: ModuleStatus;
  category?: ModuleCategory;
}): ModuleDefinition[] {
  return MODULE_REGISTRY.filter(
    (m) =>
      (options?.status === undefined || m.status === options.status) &&
      (options?.category === undefined || m.category === options.category),
  )
    .slice()
    .sort((a, b) => a.order - b.order);
}

/** Keys de módulos AVAILABLE hoy. Es la whitelist real para toggles/administración. */
export function listAvailableModuleKeys(): string[] {
  return listModules({ status: "AVAILABLE" }).map((m) => m.key);
}

/** Invariante de catálogo: ninguna key puede repetirse. Usado por tests. */
export function findDuplicateModuleKeys(): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const m of MODULE_REGISTRY) {
    if (seen.has(m.key)) dupes.add(m.key);
    seen.add(m.key);
  }
  return [...dupes];
}
