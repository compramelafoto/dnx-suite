import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";

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
  },
  {
    key: EVALUACIONES_MODULE_KEY,
    label: "Evaluaciones",
    description: "Evaluaciones asociadas a los cursos del workspace.",
    category: "GENERAL",
    order: 20,
    route: "/evaluaciones",
    status: "AVAILABLE",
  },
  {
    key: WEBSITE_MODULE_KEY,
    label: "Sitio web",
    description: "Sitio público del workspace: portada, secciones y datos de publicación.",
    category: "GENERAL",
    order: 25,
    route: "/website",
    status: "AVAILABLE",
  },

  // --- Reservados para etapas futuras. Claves fijadas, SIN implementar. ---
  {
    key: "cash",
    label: "Caja",
    description: "Ingresos y egresos genéricos del workspace.",
    category: "GENERAL",
    order: 30,
    status: "PLANNED",
  },
  {
    key: "communications",
    label: "Comunicación",
    description: "Envío de comunicaciones/email a clientes o socios del workspace.",
    category: "GENERAL",
    order: 40,
    status: "PLANNED",
  },
  {
    key: "events",
    label: "Eventos",
    description: "Eventos con inscripción y asistencia.",
    category: "GENERAL",
    order: 50,
    status: "PLANNED",
  },
  {
    key: "bookings",
    label: "Reservas",
    description: "Reserva de salón, estudio u otros recursos del workspace.",
    category: "GENERAL",
    order: 60,
    status: "PLANNED",
  },
  {
    key: "clients",
    label: "Clientes",
    description: "Padrón de clientes del workspace.",
    category: "GENERAL",
    order: 70,
    status: "PLANNED",
  },
  {
    key: MEMBERS_MODULE_KEY,
    label: "Socios",
    description: "Padrón de socios de una institución: alta, edición, categorías y estado.",
    category: "INSTITUTIONAL",
    order: 100,
    route: "/members",
    status: "AVAILABLE",
  },
  {
    key: "membership-dues",
    label: "Cuotas societarias",
    description: "Cuotas periódicas de los socios.",
    category: "INSTITUTIONAL",
    order: 110,
    status: "PLANNED",
  },
  {
    key: "governance",
    label: "Gobierno institucional",
    description: "Actas, votaciones y resoluciones institucionales.",
    category: "INSTITUTIONAL",
    order: 120,
    status: "PLANNED",
  },
  {
    key: "exhibitions",
    label: "Muestras",
    description: "Muestras institucionales.",
    category: "INSTITUTIONAL",
    order: 130,
    status: "PLANNED",
  },
  {
    key: "transparency",
    label: "Transparencia",
    description: "Publicación de balances y rendiciones institucionales.",
    category: "INSTITUTIONAL",
    order: 140,
    status: "PLANNED",
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
