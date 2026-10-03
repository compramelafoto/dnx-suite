import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";

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
};

export function isKnownAction(moduleKey: string, action: string): boolean {
  return (MODULE_ACTIONS[moduleKey] ?? []).some((a) => a.key === action);
}
