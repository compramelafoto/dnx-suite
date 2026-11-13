import "server-only";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { requireActiveWorkspace, resolveActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { REGISTRO_DOCENTE_MODULE_KEY } from "./constants";

/**
 * Guarda del Registro docente. `getModuleLevel` ya mira si el módulo está encendido en ESE espacio
 * y el rol de la persona. El personal sin roles queda en NONE (no figura en los niveles heredados):
 * son datos de menores y sólo los ve quien la docente habilite.
 */
export type CtxRegistro = { workspaceId: string; userId: number };

export async function contextoRegistro(nivel: "VIEW" | "MANAGE"): Promise<CtxRegistro | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  const level = await getModuleLevel(user.id, workspace.id, REGISTRO_DOCENTE_MODULE_KEY);
  if (!hasLevel(level, nivel)) return null;
  return { workspaceId: workspace.id, userId: user.id };
}

export async function requireRegistro(nivel: "VIEW" | "MANAGE") {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, REGISTRO_DOCENTE_MODULE_KEY);
  if (!hasLevel(level, nivel)) redirect("/dashboard");
  return { user, workspace, puedeEditar: hasLevel(level, "MANAGE") };
}
