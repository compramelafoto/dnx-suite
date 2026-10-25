import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { CONTRACTS_MODULE_KEY, type CtxContratos } from "./acceso";

/**
 * Guarda de las PANTALLAS de Contratos (las acciones usan `contextoDeContratos`, que no redirige).
 * En orden: sesión, workspace activo, módulo `contracts` encendido y el nivel pedido ("ver" = Ver;
 * "operar" = Gestionar). Igual que `lib/proyectos/pagina.ts`.
 */
export const requireContratos: (nivel?: "ver" | "operar") => Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
  ctx: CtxContratos;
}> = cache(requireContratosSinCache);

async function requireContratosSinCache(nivel: "ver" | "operar" = "ver"): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
  ctx: CtxContratos;
}> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, CONTRACTS_MODULE_KEY))) redirect("/dashboard?module=off");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, CONTRACTS_MODULE_KEY)) redirect(nivel === "operar" ? "/contratos" : "/dashboard");
  return {
    user,
    workspace,
    ctx: { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
  };
}
