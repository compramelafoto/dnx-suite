import "server-only";
import { listEditableModuleKeys } from "@/lib/commission/modules";
import { MODULE_ACTIONS } from "@/lib/permissions/actions";
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

  // Una casilla por cada acción sensible del catálogo, con su etiqueta y su descripción: la
  // grilla no inventa acciones ni se olvida de las que se agreguen al catálogo.
  const extras: AccionExtra[] = Object.entries(MODULE_ACTIONS).flatMap(([moduleKey, acciones]) =>
    acciones.map((a) => ({ moduleKey, action: a.key, label: a.label, helper: a.description })),
  );

  return { filas, fueraDeLaGrilla, extras };
}
