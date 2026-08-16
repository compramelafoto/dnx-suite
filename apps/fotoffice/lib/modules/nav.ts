import { listModules, type ModuleDefinition } from "./registry";

export type WorkspaceNavModuleItem = {
  key: string;
  label: string;
  route: string;
};

/**
 * Módulos que corresponde mostrar como link funcional en la navegación del
 * workspace (hub `/workspace`): AVAILABLE en el registry, con `route`
 * declarada, Y habilitados para este workspace puntual.
 *
 * Fuente única para el sidebar de `/workspace` y para la sección "Módulos"
 * de `/workspace` (home) — evita que cada superficie decida por su cuenta
 * qué mostrar. Un módulo PLANNED nunca puede aparecer acá: `listModules`
 * con `status: "AVAILABLE"` ya lo excluye antes de mirar `enabledModuleKeys`.
 */
export function resolveEnabledNavModules(
  enabledModuleKeys: ReadonlySet<string>,
): WorkspaceNavModuleItem[] {
  return listModules({ status: "AVAILABLE" })
    .filter((m): m is ModuleDefinition & { route: string } => Boolean(m.route))
    .filter((m) => enabledModuleKeys.has(m.key))
    .map((m) => ({ key: m.key, label: m.label, route: m.route }));
}
