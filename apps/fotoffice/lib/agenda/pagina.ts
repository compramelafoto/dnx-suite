import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { resolverAcceso } from "@/lib/access/acceso";
import { puede } from "@/lib/access/policy";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { AGENDA_MODULE_KEY, type CtxAgenda } from "./acceso";
import { asegurarTiposCitaDnx } from "./semillas";

/**
 * Guarda de las PANTALLAS de Agenda (las acciones usan `contextoDeAgenda`, que no redirige). En orden:
 * sesión, workspace activo, módulo `agenda` encendido y el nivel pedido ("ver" = Ver; "operar" =
 * Gestionar). Igual que `lib/proyectos/pagina.ts`.
 */
export const requireAgenda: (nivel?: "ver" | "operar") => Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
  ctx: CtxAgenda;
}> = cache(requireAgendaSinCache);

async function requireAgendaSinCache(nivel: "ver" | "operar" = "ver"): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
  ctx: CtxAgenda;
}> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, AGENDA_MODULE_KEY))) redirect("/dashboard?module=off");
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, AGENDA_MODULE_KEY)) redirect(nivel === "operar" ? "/agenda" : "/dashboard");
  return {
    user,
    workspace,
    ctx: { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
  };
}

/**
 * Lo que hace la pantalla de Agenda al abrirse: DNX arranca con sus tipos de cita (Reunión con cliente,
 * Evento…). Sólo crea los que faltan; una falla nunca rompe la pantalla.
 */
export async function prepararAgenda(workspaceId: string): Promise<void> {
  try {
    const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } });
    await asegurarTiposCitaDnx(workspaceId, branding?.publicSlug ?? "");
  } catch (error) {
    const e = error as { name?: string; code?: string } | null;
    console.error("[agenda] asegurarTiposCitaDnx falló", { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
  }
}
