import "server-only";
import { redirect } from "next/navigation";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { QUOTES_MODULE_KEY, type CtxPresupuestos } from "./acceso";

/**
 * Guarda de las PANTALLAS de Presupuestos (las acciones usan `contextoDePresupuestos`, que no
 * redirige). En orden: sesión, workspace activo, módulo `quotes` encendido y el nivel pedido
 * ("ver" = Ver; "operar" = Gestionar). Devuelve el contexto con el acceso resuelto, para que la
 * pantalla decida qué mostrar con la misma regla que después aplican las acciones.
 */
export async function requirePresupuestos(nivel: "ver" | "operar" = "ver"): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
  ctx: CtxPresupuestos;
}> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, QUOTES_MODULE_KEY))) redirect("/dashboard?module=off");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, QUOTES_MODULE_KEY)) redirect(nivel === "operar" ? "/presupuestos" : "/dashboard");
  return {
    user,
    workspace,
    ctx: { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
  };
}
