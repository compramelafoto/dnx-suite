import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { GOVERNANCE_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor (diseño §13).
 *
 * - VIEW: ver todos los proyectos, tareas, archivos e historial.
 * - MANAGE: crear y editar proyectos, etapas y tareas; cambiar estados; tipos de proyecto.
 * - El responsable de una tarea, aunque sólo vea, carga sus avances y la cierra.
 *
 * Dueño y admin gestionan siempre. Los roles de la comisión salen de las plantillas: Presidencia y
 * Secretaría gestionan, el resto ve. El personal sin roles no entra: Gobierno no existía antes de
 * los roles y no hay una compatibilidad que conservar.
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, GOVERNANCE_MODULE_KEY);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  // La ficha de socio de quien mira, si la tiene: es lo que lo hace responsable de una tarea.
  const member = await prisma.member.findFirst({
    where: { workspaceId: workspace.id, userId: user.id },
    select: { id: true },
  });
  return {
    user,
    workspace,
    level,
    canManage: hasLevel(level, "MANAGE"),
    viewerMemberId: member?.id ?? null,
  };
}

export type GovernanceContext = Awaited<ReturnType<typeof contextoBase>>;

export async function requireGovernanceViewer(): Promise<GovernanceContext> {
  return contextoBase();
}

export async function requireGovernanceManager(): Promise<GovernanceContext> {
  const ctx = await contextoBase();
  if (!ctx.canManage) redirect("/gobierno?error=" + encodeURIComponent("Para eso hace falta gestionar proyectos."));
  return ctx;
}

/** Quien gestiona, o el responsable de la tarea. */
export function canWorkOnTask(ctx: GovernanceContext, task: { assigneeMemberId: string | null }): boolean {
  return ctx.canManage || (ctx.viewerMemberId !== null && task.assigneeMemberId === ctx.viewerMemberId);
}

/** Nombre legible de quien actúa, para el historial. */
export function actorLabel(user: { name?: string | null; email?: string | null }): string {
  return user.name?.trim() || user.email || "Equipo";
}
