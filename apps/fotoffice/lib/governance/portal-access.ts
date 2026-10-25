import "server-only";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { GOVERNANCE_MODULE_KEY } from "./constants";

/**
 * El socio en Gobierno: sesión, ficha de socio activa y el módulo encendido en su institución.
 *
 * No pasa por los niveles del panel: un socio sin cargo no "ve" Gobierno, pero sí puede proponer,
 * seguir sus propuestas, ver lo que la comisión hizo visible y cumplir las tareas que le asignaron.
 * Cada lectura filtra por su ficha; nada se toma del navegador.
 */
export async function loadPortalGovernance() {
  const user = await requireAuth();
  const ctx = await loadPortalContext(user.id);
  if (!ctx) return null;
  if (!(await isModuleEnabledForWorkspace(ctx.workspace.id, GOVERNANCE_MODULE_KEY))) return null;
  return { user, member: ctx.member, workspace: ctx.workspace, actor: `${ctx.member.firstName} ${ctx.member.lastName}`.trim() };
}

export async function requirePortalGovernance() {
  const ctx = await loadPortalGovernance();
  if (!ctx) redirect("/portal");
  return ctx;
}
