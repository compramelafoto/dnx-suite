import "server-only";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { BANDEJA_MODULE_KEY } from "./constantes";
import { puedeOperarBandeja, type CtxBandeja } from "./acceso";

/**
 * Guarda de las PANTALLAS de la Bandeja (las acciones usan `contextoDeBandeja`, que no redirige).
 * En orden: sesión, workspace activo, módulo `whatsapp-inbox` encendido y "Ver". Devuelve el
 * contexto y si la persona puede operar (responder, tomar, devolver, resolver, vincular).
 */
export async function requireBandeja(): Promise<{ ctx: CtxBandeja; puedeOperar: boolean }> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, BANDEJA_MODULE_KEY))) redirect("/dashboard?module=off");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "ver", BANDEJA_MODULE_KEY)) redirect("/dashboard");
  const ctx: CtxBandeja = { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
  return { ctx, puedeOperar: puedeOperarBandeja(ctx) };
}
