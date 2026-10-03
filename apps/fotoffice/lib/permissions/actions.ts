import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";

/**
 * Catálogo de acciones sensibles por módulo (diseño de roles, §12.1.2 y etapa 2b).
 *
 * Una acción sólo se otorga dentro de un rol con nivel `MANAGE` en ese módulo. Lo que no está en
 * este catálogo no se puede asignar: la grilla de la Comisión directiva lo descarta.
 */

export type ModuleActionDef = { key: string; label: string; description: string };

/** Acción sensible de Caja: reservar, gastar e ingresar plata de proyectos (§12.1.2). */
export const CASH_PROJECT_MONEY_ACTION = "cash.project_money";

export const MODULE_ACTIONS: Readonly<Record<string, readonly ModuleActionDef[]>> = {
  [CASH_MODULE_KEY]: [
    {
      key: "cash.configure",
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
      key: "coverages.coordinate",
      label: "Coordinar coberturas",
      description: "Aprobar, rechazar, cerrar, asignar equipo, convocatorias y ajustes.",
    },
  ],
};

export function isKnownAction(moduleKey: string, action: string): boolean {
  return (MODULE_ACTIONS[moduleKey] ?? []).some((a) => a.key === action);
}
