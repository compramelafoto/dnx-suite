import "server-only";
import { prisma } from "@repo/db";
import { listActiveOfficeHolders } from "@/lib/commission/terms";
import type { ProjectStatus, TaskStatus } from "./constants";

/**
 * Lecturas del módulo. Todas filtran por `workspaceId`: nunca se lee un proyecto por su id solo.
 */

const nombre = (m: { firstName: string; lastName: string } | null | undefined) =>
  m ? `${m.firstName} ${m.lastName}`.trim() : null;

export async function listProjects(workspaceId: string) {
  const rows = await prisma.govProject.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      origin: true,
      deadlineAt: true,
      visibleToMembers: true,
      createdAt: true,
      type: { select: { name: true } },
      responsible: { select: { firstName: true, lastName: true } },
      tasks: { select: { status: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    status: r.status as ProjectStatus,
    tasks: r.tasks.map((t) => ({ status: t.status as TaskStatus })),
    responsibleName: nombre(r.responsible),
  }));
}

export async function getProject(workspaceId: string, projectId: string) {
  const p = await prisma.govProject.findFirst({
    where: { id: projectId, workspaceId },
    include: {
      type: { select: { id: true, name: true } },
      responsible: { select: { id: true, firstName: true, lastName: true } },
      proposedBy: { select: { id: true, firstName: true, lastName: true } },
      stages: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          tasks: {
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            include: {
              assignee: { select: { id: true, firstName: true, lastName: true } },
              _count: { select: { updates: true } },
            },
          },
        },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 200 },
    },
  });
  if (!p) return null;
  return {
    ...p,
    status: p.status as ProjectStatus,
    stages: p.stages.map((s) => ({
      ...s,
      tasks: s.tasks.map((t) => ({ ...t, status: t.status as TaskStatus, assigneeName: nombre(t.assignee) })),
    })),
  };
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;

export async function getTask(workspaceId: string, projectId: string, taskId: string) {
  const t = await prisma.govProjectTask.findFirst({
    where: { id: taskId, projectId, project: { workspaceId } },
    include: {
      stage: { select: { id: true, title: true } },
      project: { select: { id: true, title: true, status: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      updates: {
        orderBy: { createdAt: "desc" },
        include: { attachments: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!t) return null;
  return {
    ...t,
    status: t.status as TaskStatus,
    project: { ...t.project, status: t.project.status as ProjectStatus },
    assigneeName: nombre(t.assignee),
  };
}

/** El tablero: todas las tareas de los proyectos que siguen vivos. */
export async function listBoardTasks(workspaceId: string) {
  const rows = await prisma.govProjectTask.findMany({
    where: {
      project: { workspaceId, status: { notIn: ["ARCHIVED", "REJECTED", "CANCELLED", "MEMBER_PROPOSAL"] } },
    },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      assigneeMemberId: true,
      assignee: { select: { firstName: true, lastName: true } },
      stage: { select: { title: true } },
      project: { select: { id: true, title: true, status: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    status: r.status as TaskStatus,
    project: { ...r.project, status: r.project.status as ProjectStatus },
    assigneeName: nombre(r.assignee),
  }));
}

export type MemberOption = { id: string; label: string };

/**
 * A quién se le puede asignar algo: primero la comisión (con su cargo), después el resto de los
 * socios activos por apellido. Los inactivos no se ofrecen, pero quien ya tenía una tarea la
 * conserva.
 */
export async function listMemberOptions(workspaceId: string): Promise<{
  commission: MemberOption[];
  others: MemberOption[];
}> {
  const [holders, members] = await Promise.all([
    listActiveOfficeHolders(workspaceId).catch(() => []),
    prisma.member.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, memberNumber: true },
    }),
  ]);
  const cargoPorSocio = new Map<string, string>();
  for (const h of holders) {
    if (h.memberId && !cargoPorSocio.has(h.memberId)) cargoPorSocio.set(h.memberId, h.officeName);
  }
  const commission: MemberOption[] = [];
  const others: MemberOption[] = [];
  for (const m of members) {
    const base = `${m.lastName}, ${m.firstName}`.trim();
    const cargo = cargoPorSocio.get(m.id);
    if (cargo) commission.push({ id: m.id, label: `${base} — ${cargo}` });
    else others.push({ id: m.id, label: `${base} (n.º ${m.memberNumber})` });
  }
  return { commission, others };
}

/** Que un socio sea de esta institución. Se pregunta antes de asignarle algo. */
export async function memberBelongs(workspaceId: string, memberId: string): Promise<{ name: string } | null> {
  const m = await prisma.member.findFirst({
    where: { id: memberId, workspaceId },
    select: { firstName: true, lastName: true },
  });
  return m ? { name: `${m.firstName} ${m.lastName}`.trim() } : null;
}

export async function listProjectTypes(workspaceId: string, opts: { includeArchived?: boolean } = {}) {
  return prisma.govProjectType.findMany({
    where: { workspaceId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      stages: { orderBy: { order: "asc" }, include: { tasks: { orderBy: { order: "asc" } } } },
      _count: { select: { projects: true } },
    },
  });
}
