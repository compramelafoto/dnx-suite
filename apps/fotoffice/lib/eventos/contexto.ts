import "server-only";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { requireActiveWorkspace, resolveActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { EVENTOS_MODULE_KEY } from "./constants";

/**
 * Guarda de Eventos. `getModuleLevel` ya incluye si el módulo está encendido en ESE negocio y el
 * rol de la persona. VIEW = ver eventos e inscriptos; MANAGE = cargar, cobrar y acreditar.
 */
export type CtxEventos = { workspaceId: string; userId: number };

export async function contextoEventos(nivel: "VIEW" | "MANAGE"): Promise<CtxEventos | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  const level = await getModuleLevel(user.id, workspace.id, EVENTOS_MODULE_KEY);
  if (!hasLevel(level, nivel)) return null;
  return { workspaceId: workspace.id, userId: user.id };
}

export async function requireEventos(nivel: "VIEW" | "MANAGE") {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, EVENTOS_MODULE_KEY);
  if (!hasLevel(level, nivel)) redirect("/dashboard");
  return { user, workspace, puedeEditar: hasLevel(level, "MANAGE") };
}
