import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { GALLERY_MODULE_KEY, type CtxGalerias } from "./acceso";

/**
 * Guarda de las PANTALLAS de Galería (las acciones usan `contextoDeGalerias`, que no redirige).
 * En orden: sesión, workspace activo, módulo `gallery` encendido y el nivel pedido ("ver" = Ver;
 * "operar" = Gestionar). Igual que `lib/contratos/requerir.ts`.
 */
export const requireGalerias: (nivel?: "ver" | "operar") => Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
  ctx: CtxGalerias;
}> = cache(requireGaleriasSinCache);

async function requireGaleriasSinCache(nivel: "ver" | "operar" = "ver"): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
  ctx: CtxGalerias;
}> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, GALLERY_MODULE_KEY))) redirect("/dashboard?module=off");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, GALLERY_MODULE_KEY)) redirect(nivel === "operar" ? "/galerias" : "/dashboard");
  return {
    user,
    workspace,
    ctx: { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
  };
}
