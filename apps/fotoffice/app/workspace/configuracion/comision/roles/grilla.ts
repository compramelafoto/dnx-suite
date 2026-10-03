import "server-only";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { listEditableModuleKeys } from "@/lib/commission/modules";
import { CASH_PROJECT_MONEY_ACTION } from "@/lib/commission/templates";
import { getModuleDefinition } from "@/lib/modules/registry";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";
import type { AccionExtra, FilaGrilla, NivelGrilla } from "./rol-form";

type Permiso = { moduleKey: string; level: string; actions: string[] };

const NIVEL_TEXTO: Record<string, string> = { VIEW: "ver", MANAGE: "gestionar" };

/**
 * La grilla de un rol: una fila por módulo disponible y encendido en el workspace, con el mismo
 * criterio que usan las acciones al guardar (`listEditableModuleKeys`). Lo que el rol tenga en
 * módulos planificados o apagados no se edita acá: se lista aparte y se conserva al guardar.
 */
export async function armarGrilla(workspaceId: string, permisos: Permiso[]) {
  const [editables, vocab] = await Promise.all([
    listEditableModuleKeys(workspaceId),
    loadPersonVocabulary(workspaceId),
  ]);
  const etiqueta = (key: string) => aplicarVocabulario(getModuleDefinition(key)?.label ?? key, vocab);
  const porModulo = new Map(permisos.map((p) => [p.moduleKey, p]));
  const editable = new Set(editables);

  const filas: FilaGrilla[] = editables.map((key) => {
    const p = porModulo.get(key);
    const level: NivelGrilla = p?.level === "VIEW" || p?.level === "MANAGE" ? p.level : "NONE";
    return { moduleKey: key, label: etiqueta(key), level, actions: p ? [...p.actions] : [] };
  });

  const fueraDeLaGrilla = permisos
    .filter((p) => !editable.has(p.moduleKey) && p.level !== "NONE")
    .map((p) => `${etiqueta(p.moduleKey)} (${NIVEL_TEXTO[p.level] ?? p.level.toLowerCase()})`)
    .sort((a, b) => a.localeCompare(b, "es"));

  const extras: AccionExtra[] = [
    {
      moduleKey: CASH_MODULE_KEY,
      action: CASH_PROJECT_MONEY_ACTION,
      label: "Plata de proyectos",
      helper: "Puede reservar, gastar e ingresar plata de los proyectos, no sólo los movimientos comunes.",
    },
  ];

  return { filas, fueraDeLaGrilla, extras };
}
