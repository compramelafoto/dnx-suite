import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { DIGITALIZACION_MODULE_KEY } from "@/lib/digitalizacion/constants";
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
import { REPORTS_MODULE_KEY } from "@/lib/informes/constantes";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { STORE_MODULE_KEY } from "@/lib/store/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";
import { PRINT_ORDERS_MODULE_KEY } from "@/lib/impresiones/constantes";
import { BANDEJA_MODULE_KEY } from "@/lib/bandeja/constantes";
import { CUANTO_COBRO_SOCIO_MODULE_KEY } from "@/lib/cuanto-cobro-socio/constants";
import { FOTOLIBROS_SOCIO_MODULE_KEY } from "@/lib/fotolibro/constantes";
import { INVOICING_MODULE_KEY } from "@/lib/invoicing/constants";
import { EQUIPO_MODULE_KEY } from "@/lib/equipo/constantes";

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
    // Facturación electrónica con ARCA (§11 del diseño de negocio): Factura C y Nota de crédito C
    // con CAE en tiempo real. Apagado por omisión; la puesta en marcha (certificado, punto de venta,
    // homologación) la hace el titular del CUIT desde Configuración → Facturación electrónica.
    key: INVOICING_MODULE_KEY,
    label: "Facturación electrónica",
    description:
      "Factura C y nota de crédito C con CAE de ARCA, desde las ventas y los pedidos, con el PDF y el código QR.",
    category: "GENERAL",
    order: 38,
    route: "/facturacion",
    status: "AVAILABLE",
    family: "negocio",
  },
  {
    key: DIGITALIZACION_MODULE_KEY,
    label: "Digitalización",
    description:
      "Digitalización de VHS y DVD: graba desde la capturadora en segundo plano, sube en tiempo real y corta sola cuando la cinta termina.",
    category: "GENERAL",
    order: 37,
    route: "/digitalizacion",
    status: "AVAILABLE",
    family: "negocio",
    platformFee: true,
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
    // Bandeja de WhatsApp (Etapa A): chats de la línea de la institución, con bot, toma por una
    // persona y respuesta desde el panel. La conexión real con Meta se configura aparte.
    key: BANDEJA_MODULE_KEY,
    label: "Bandeja de WhatsApp",
    description:
      "Los chats de WhatsApp de la institución en una bandeja: quién los atiende (bot o una persona), respuestas desde el panel y cada cliente vinculado a su ficha.",
    category: "GENERAL",
    order: 41,
    route: "/bandeja",
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
    // Sin `route` a propósito: no tiene pantalla en el panel. Lo que el socio carga es suyo y la
    // institución no lo ve; el interruptor sólo decide si aparece en el portal.
    key: CUANTO_COBRO_SOCIO_MODULE_KEY,
    label: "¿Cuánto Cobro? para {personas}",
    description:
      "Cada una de las {personas} calcula desde su portal cuánto cobrar: lo que necesita ganar por mes, sus gastos fijos, sus horas y los gastos de cada trabajo. Lo que carga es personal: la institución no lo ve.",
    category: "INSTITUTIONAL",
    order: 119,
    status: "AVAILABLE",
    family: "institucion",
    dependsOn: [MEMBERS_MODULE_KEY],
  },
  {
    // Sin `route`, como ¿Cuánto Cobro?: lo que diseña el socio es suyo y la institución no lo ve.
    key: FOTOLIBROS_SOCIO_MODULE_KEY,
    label: "Fotolibros para {personas}",
    description:
      "Cada una de las {personas} diseña sus fotolibros desde su portal, con la medida real del pliego de los laboratorios, encuadre de cada foto y listos para imprimir. Lo que diseña es personal: la institución no lo ve.",
    category: "INSTITUTIONAL",
    order: 119.5,
    status: "AVAILABLE",
    family: "institucion",
    dependsOn: [MEMBERS_MODULE_KEY],
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
    description: "Galerías de fotos de cada proyecto: el cliente mira, elige las que quiere y te manda su selección.",
    category: "GENERAL",
    order: 29,
    status: "AVAILABLE",
    route: "/galerias",
    family: "negocio",
    dependsOn: ["projects"],
  },
  {
    key: PRINT_ORDERS_MODULE_KEY,
    label: "Pedidos de impresión",
    description: "Tus clientes piden copias impresas desde el enlace de sus fotos, pagan online y el pedido sale solo al laboratorio.",
    category: "GENERAL",
    order: 95,
    status: "AVAILABLE",
    route: "/workspace/configuracion/impresiones",
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
  {
    key: REPORTS_MODULE_KEY,
    label: "Informes",
    description: "Resultados por rubro y mes, flujo de caja proyectado y control de monotributo, con descarga a planilla.",
    category: "GENERAL",
    order: 37,
    status: "AVAILABLE",
    route: "/informes",
    family: "negocio",
  },
  {
    // Equipo (etapas 1 y 2): fichas de empleada, jornada del día desde la caja, pase de turno y
    // mensajes al abrir, antes de salir y al cerrar. Apagado por omisión, como todos: lo enciende
    // el administrador de la plataforma. El panel es sólo de dueño o administrador.
    key: EQUIPO_MODULE_KEY,
    label: "Equipo",
    description:
      "Fichas y horarios del equipo de mostrador, la jornada de cada día según la apertura y el cierre de caja, y saludos que cambian todos los días.",
    category: "GENERAL",
    order: 38,
    route: "/equipo",
    status: "AVAILABLE",
    family: "negocio",
    dependsOn: [CASH_MODULE_KEY],
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
