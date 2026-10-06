import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { SPONSORS_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor.
 *
 * Dos escalones: VIEW ve los sponsors y dónde están; MANAGE los da de alta, edita, sube logos
 * y los ubica. Esconder un botón es lo cosmético, nunca el control.
 */
async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, SPONSORS_MODULE_KEY);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  return { user, workspace, level, canManage: hasLevel(level, "MANAGE") };
}

export async function requireSponsorsViewer() {
  return contextoBase();
}

export async function requireSponsorsManager() {
  const ctx = await contextoBase();
  if (!ctx.canManage) redirect("/sponsors");
  return ctx;
}
