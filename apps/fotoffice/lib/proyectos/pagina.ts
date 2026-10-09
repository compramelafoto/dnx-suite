import "server-only";
import { redirect } from "next/navigation";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { prisma } from "@repo/db";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { PROJECTS_MODULE_KEY, type CtxProyectos } from "./acceso";
import { asegurarRolesProyectoDnx } from "./semillas";

/**
 * Guarda de las PANTALLAS de Proyectos (las acciones usan `contextoDeProyectos`, que no redirige).
 * En orden: sesión, workspace activo, módulo `projects` encendido y el nivel pedido ("ver" = Ver;
 * "operar" = Gestionar). Igual que `lib/pedidos/pagina.ts`.
 */
export async function requireProyectos(nivel: "ver" | "operar" = "ver"): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
  ctx: CtxProyectos;
}> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, PROJECTS_MODULE_KEY))) redirect("/dashboard?module=off");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, PROJECTS_MODULE_KEY)) redirect(nivel === "operar" ? "/proyectos" : "/dashboard");
  return {
    user,
    workspace,
    ctx: { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
  };
}

/**
 * Lo que hacen las pantallas de Proyectos al abrirse: DNX arranca con sus roles de participante
 * (Fotógrafo Principal, Salón, DJ…). Sólo crea los que faltan; una falla nunca rompe la pantalla.
 */
export async function prepararProyectos(workspaceId: string): Promise<void> {
  try {
    const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } });
    await asegurarRolesProyectoDnx(workspaceId, branding?.publicSlug ?? "");
  } catch (error) {
    const e = error as { name?: string; code?: string } | null;
    console.error("[proyectos] asegurarRolesProyectoDnx falló", { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
  }
}
