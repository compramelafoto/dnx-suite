import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { STORE_MODULE_KEY } from "@/lib/store/constants";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";

/**
 * Catálogo de acciones sensibles por módulo (diseño de roles, §12.1.2 y etapa 2b).
 *
 * Una acción sólo se otorga dentro de un rol con nivel `MANAGE` en ese módulo. Lo que no está en
 * este catálogo no se puede asignar: la grilla de la Comisión directiva lo descarta.
 */

export type ModuleActionDef = { key: string; label: string; description: string };

/** Acción sensible de Caja: reservar, gastar e ingresar plata de proyectos (§12.1.2). */
export const CASH_PROJECT_MONEY_ACTION = "cash.project_money";

/** Acción sensible de Caja: cuentas, categorías y encender el módulo (etapa 2b). */
export const CASH_CONFIGURE_ACTION = "cash.configure";

/** Acción sensible de Coberturas: aprobar, rechazar, cerrar, asignar, convocar y ajustes (etapa 2b). */
export const COVERAGES_COORDINATE_ACTION = "coverages.coordinate";

/** Acción sensible de Reservas: espacios, extras, tarifas y reglas (etapa 2b). */
export const BOOKINGS_CONFIGURE_ACTION = "bookings.configure";

/** Acción sensible de Sorteos: crear, anunciar, sellar, resolver y cancelar (etapa 2b). */
export const RAFFLES_CONDUCT_ACTION = "raffles.conduct";

/** Acción sensible de Ventas: alta y edición de productos, precios, costos y categorías. */
export const SALES_CATALOG_ACTION = "sales.catalog";

/** Acción sensible de la Tienda online: abrirla o cerrarla, el retiro, las políticas y los avisos. */
export const STORE_CONFIGURE_ACTION = "store.configure";

/**
 * Acción sensible de Gobierno: editar cualquier proyecto de la comisión (datos, estado, etapas,
 * quitar tareas, visibilidad de archivos) y administrar los tipos de proyecto. Sin ella, quien
 * gestiona edita sólo los proyectos de los que es responsable o que creó.
 */
export const GOVERNANCE_COORDINATE_ACTION = "governance.coordinate";

export const MODULE_ACTIONS: Readonly<Record<string, readonly ModuleActionDef[]>> = {
  [CASH_MODULE_KEY]: [
    {
      key: CASH_CONFIGURE_ACTION,
      label: "Configurar Caja",
      description: "Cuentas, categorías y encender el módulo.",
    },
    {
      key: CASH_PROJECT_MONEY_ACTION,
      label: "Plata de proyectos",
      description: "Reservar, gastar e ingresar plata de proyectos de Gobierno.",
    },
  ],
  [COVERAGES_MODULE_KEY]: [
    {
      key: COVERAGES_COORDINATE_ACTION,
      label: "Coordinar coberturas",
      description: "Aprobar, rechazar, cerrar, asignar equipo, convocatorias y ajustes.",
    },
  ],
  [BOOKINGS_MODULE_KEY]: [
    {
      key: BOOKINGS_CONFIGURE_ACTION,
      label: "Configurar reservas",
      description: "Espacios, extras, tarifas y reglas.",
    },
  ],
  [RAFFLES_MODULE_KEY]: [
    {
      key: RAFFLES_CONDUCT_ACTION,
      label: "Conducir sorteos",
      description: "Crear, anunciar, sellar, resolver y cancelar sorteos.",
    },
  ],
  [SALES_MODULE_KEY]: [
    {
      key: SALES_CATALOG_ACTION,
      label: "Editar el catálogo",
      description: "Alta y edición de productos, precios, costos y categorías.",
    },
  ],
  [GOVERNANCE_MODULE_KEY]: [
    {
      key: GOVERNANCE_COORDINATE_ACTION,
      label: "Coordinar proyectos",
      description:
        "Editar, cambiar de estado y armar las etapas de cualquier proyecto, y administrar los tipos de proyecto.",
    },
  ],
  [STORE_MODULE_KEY]: [
    {
      key: STORE_CONFIGURE_ACTION,
      label: "Configurar la tienda",
      description: "Abrir o cerrar la tienda, retiro, políticas y avisos.",
    },
  ],
};

export function isKnownAction(moduleKey: string, action: string): boolean {
  return (MODULE_ACTIONS[moduleKey] ?? []).some((a) => a.key === action);
}
