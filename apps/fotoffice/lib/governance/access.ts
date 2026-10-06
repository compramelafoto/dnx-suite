import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel, hasModuleAction } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { GOVERNANCE_COORDINATE_ACTION } from "@/lib/permissions/actions";
import { GOVERNANCE_MODULE_KEY, type ProjectStatus } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor (diseño §13). Esconder un botón es lo
 * cosmético; cada acción vuelve a preguntar acá.
 *
 * - VIEW: ver todos los proyectos, tareas, archivos e historial.
 * - MANAGE: crear proyectos; agregar tareas y repartirlas (asignarlas a otros); editar tareas;
 *   anotar en el historial; subir archivos y cargar avances.
 * - Editar UN proyecto —sus datos y su responsable, cambiarle el estado, armar sus etapas (agregar,
 *   renombrar, mover, quitar), quitar tareas y decidir qué archivos ven los socios— es de quien
 *   gestiona y además: es su responsable general (`responsibleMemberId`), lo creó
 *   (`createdByUserId`), o tiene la acción sensible `governance.coordinate` ("Coordinar proyectos").
 *   Ver `canEditProject` y `requireProjectEditor`.
 * - Los tipos de proyecto (las plantillas) son sólo de quien coordina: `requireGovernanceCoordinator`.
 * - El responsable de una tarea, aunque sólo vea, carga sus avances y la cierra (`canWorkOnTask`).
 *
 * Excepciones a propósito, que siguen con MANAGE solo:
 * - Las decisiones de una reunión (`treatAgendaItemAction` en `reuniones/actions.ts`) cambian el
 *   estado del proyecto sin ser su editor: son decisiones colegiadas de la comisión y quedan en el
 *   acta, no de una persona.
 * - La plata del proyecto (`dinero-actions.ts`) no sigue esta regla: las cotizaciones y las
 *   estimaciones de las etapas piden MANAGE; reservar, gastar, ingresar y el saldo inicial piden
 *   además "Plata de proyectos" de Caja (`canHandleProjectMoney`).
 *
 * Dueño y admin gestionan y coordinan siempre (`resolveModuleAction` les da toda acción). Los roles
 * de la comisión salen de las plantillas: Presidencia y Secretaría gestionan Gobierno y traen
 * `governance.coordinate` de fábrica; el resto ve. En la grilla de roles se puede sacar o dar a
 * otro rol. El personal sin roles no entra: Gobierno no existía antes de los roles y no hay una
 * compatibilidad que conservar.
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [level, tieneCoordinar] = await Promise.all([
    getModuleLevel(user.id, workspace.id, GOVERNANCE_MODULE_KEY),
    hasModuleAction(user.id, workspace.id, GOVERNANCE_MODULE_KEY, GOVERNANCE_COORDINATE_ACTION),
  ]);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  const canManage = hasLevel(level, "MANAGE");
  // La ficha de socio de quien mira, si la tiene: es lo que lo hace responsable de una tarea.
  const member = await prisma.member.findFirst({
    where: { workspaceId: workspace.id, userId: user.id },
    select: { id: true },
  });
  return {
    user,
    workspace,
    level,
    canManage,
    // La acción sólo vale con MANAGE: `resolveModuleAction` ya lo exige, esto lo repite por las dudas.
    canCoordinate: canManage && tieneCoordinar,
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

/** Coordinar: editar cualquier proyecto y administrar los tipos de proyecto. */
export async function requireGovernanceCoordinator(): Promise<GovernanceContext> {
  const ctx = await requireGovernanceManager();
  if (!ctx.canCoordinate) {
    redirect("/gobierno?error=" + encodeURIComponent("Para eso hace falta coordinar los proyectos."));
  }
  return ctx;
}

export const PROJECT_EDITOR_FORBIDDEN = "Ese proyecto lo edita su responsable o quien coordina los proyectos.";

/**
 * Si quien mira puede editar ESTE proyecto: gestiona y además coordina, es su responsable general
 * o lo creó. Puro: la pantalla lo usa para mostrar los controles y la acción para permitirlos.
 */
export function canEditProject(
  ctx: Pick<GovernanceContext, "canManage" | "canCoordinate" | "viewerMemberId"> & { user: { id: number } },
  project: { responsibleMemberId: string | null; createdByUserId: number | null },
): boolean {
  if (!ctx.canManage) return false;
  if (ctx.canCoordinate) return true;
  if (ctx.viewerMemberId !== null && project.responsibleMemberId === ctx.viewerMemberId) return true;
  return project.createdByUserId !== null && project.createdByUserId === ctx.user.id;
}

/**
 * La guarda de las acciones que editan un proyecto. Lo busca DENTRO del workspace (uno ajeno
 * cuenta como inexistente) y devuelve el contexto con el proyecto.
 */
export async function requireProjectEditor(projectId: string) {
  const ctx = await requireGovernanceManager();
  const p = await prisma.govProject.findFirst({
    where: { id: projectId, workspaceId: ctx.workspace.id },
    select: {
      id: true,
      status: true,
      title: true,
      description: true,
      deadlineAt: true,
      visibleToMembers: true,
      responsibleMemberId: true,
      createdByUserId: true,
    },
  });
  if (!p) redirect("/gobierno?error=" + encodeURIComponent("Ese proyecto no existe."));
  if (!canEditProject(ctx, p)) {
    redirect(`/gobierno/${p.id}?error=${encodeURIComponent(PROJECT_EDITOR_FORBIDDEN)}`);
  }
  return { ...ctx, project: { ...p, status: p.status as ProjectStatus } };
}

/** Quien gestiona, o el responsable de la tarea. */
export function canWorkOnTask(ctx: GovernanceContext, task: { assigneeMemberId: string | null }): boolean {
  return ctx.canManage || (ctx.viewerMemberId !== null && task.assigneeMemberId === ctx.viewerMemberId);
}

/** Nombre legible de quien actúa, para el historial. */
export function actorLabel(user: { name?: string | null; email?: string | null }): string {
  return user.name?.trim() || user.email || "Equipo";
}
