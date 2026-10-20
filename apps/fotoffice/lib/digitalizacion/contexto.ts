import "server-only";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { requireActiveWorkspace, resolveActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { DIGITALIZACION_MODULE_KEY } from "./constants";

/**
 * Guarda de Digitalización. `getModuleLevel` ya incluye si el módulo está encendido en ESE negocio
 * y el rol de la persona. VIEW = ver la lista; MANAGE = grabar, continuar, terminar y descartar.
 */
export type CtxDigitalizacion = { workspaceId: string; userId: number };

export async function contextoDigitalizacion(nivel: "VIEW" | "MANAGE"): Promise<CtxDigitalizacion | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  const level = await getModuleLevel(user.id, workspace.id, DIGITALIZACION_MODULE_KEY);
  if (!hasLevel(level, nivel)) return null;
  return { workspaceId: workspace.id, userId: user.id };
}

export async function requireDigitalizacion(nivel: "VIEW" | "MANAGE") {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, DIGITALIZACION_MODULE_KEY);
  if (!hasLevel(level, nivel)) redirect("/dashboard");
  return { user, workspace, puedeGrabar: hasLevel(level, "MANAGE") };
}
