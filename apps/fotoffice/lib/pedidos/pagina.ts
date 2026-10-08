import "server-only";
import { redirect } from "next/navigation";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { ORDERS_MODULE_KEY, type CtxPedidos } from "./acceso";

/**
 * Guarda de las PANTALLAS de Pedidos (las acciones usan `contextoDePedidos`, que no redirige). En
 * orden: sesión, workspace activo, módulo `orders` encendido y el nivel pedido ("ver" = Ver;
 * "operar" = Gestionar). Igual que `lib/presupuestos/pagina.ts`.
 */
export async function requirePedidos(nivel: "ver" | "operar" = "ver"): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
  ctx: CtxPedidos;
}> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, ORDERS_MODULE_KEY))) redirect("/dashboard?module=off");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, ORDERS_MODULE_KEY)) redirect(nivel === "operar" ? "/pedidos" : "/dashboard");
  return {
    user,
    workspace,
    ctx: { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
  };
}
