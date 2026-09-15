import { listModules, type ModuleDefinition } from "./registry";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";

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
 *
 * `vocabulary` resuelve los marcadores ({persona}, {personas}, etc.) que
 * `MODULE_REGISTRY` deja sin resolver a propósito: ese catálogo es global y
 * no sabe en qué workspace está parado quien mira. Quien llama a esta
 * función sí lo sabe — un workspace real pasa `loadPersonVocabulary(id)`, y
 * una pantalla sin workspace (el panel de super admin) pasa
 * `personVocabulary(null)` para conservar "Socios" tal como está hoy.
 */
export function resolveEnabledNavModules(
  enabledModuleKeys: ReadonlySet<string>,
  vocabulary: PersonVocabulary,
): WorkspaceNavModuleItem[] {
  return listModules({ status: "AVAILABLE" })
    .filter((m): m is ModuleDefinition & { route: string } => Boolean(m.route))
    .filter((m) => enabledModuleKeys.has(m.key))
    .map((m) => ({
      key: m.key,
      label: aplicarVocabulario(m.label, vocabulary),
      route: m.route,
    }));
}
