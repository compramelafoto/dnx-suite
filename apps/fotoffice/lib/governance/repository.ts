import "server-only";
import { prisma } from "@repo/db";
import { listActiveOfficeHolders } from "@/lib/commission/terms";
import type { ProjectStatus, TaskStatus } from "./constants";
import { tally, votingRoll } from "./votes";

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
  // Orden alfabético en castellano: la base ordena por bytes y deja "robledo" después de "Woelflin".
  const ordenados = members.slice().sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName, "es", { sensitivity: "base" }) ||
      a.firstName.localeCompare(b.firstName, "es", { sensitivity: "base" }),
  );
  for (const m of ordenados) {
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

// ─── Votación ────────────────────────────────────────────────────────────────

/**
 * Quiénes votan hoy y los votos de los proyectos pedidos. Un solo viaje a la base por tabla: la
 * lista de proyectos necesita el recuento de todos a la vez para ordenar por prioridad.
 */
export async function loadVoting(workspaceId: string, projectIds: readonly string[]) {
  const [holders, votes] = await Promise.all([
    listActiveOfficeHolders(workspaceId).catch(() => []),
    projectIds.length === 0
      ? Promise.resolve([])
      : prisma.govVote.findMany({
          where: { projectId: { in: [...projectIds] }, project: { workspaceId } },
          select: { projectId: true, voterUserId: true, value: true, updatedAt: true },
        }),
  ]);
  const roll = votingRoll(holders);
  const porProyecto = new Map<string, { voterUserId: number; value: string; updatedAt: Date }[]>();
  for (const v of votes) {
    const lista = porProyecto.get(v.projectId) ?? [];
    lista.push(v);
    porProyecto.set(v.projectId, lista);
  }
  return {
    holders,
    roll,
    tallyOf: (projectId: string) => tally(porProyecto.get(projectId) ?? [], roll.userIds, roll.total),
    votesOf: (projectId: string) => porProyecto.get(projectId) ?? [],
  };
}

// ─── Reuniones ───────────────────────────────────────────────────────────────

export async function listMeetings(workspaceId: string) {
  return prisma.govMeeting.findMany({
    where: { workspaceId },
    orderBy: { scheduledAt: "desc" },
    include: { _count: { select: { items: true, attendees: true } } },
  });
}

export async function getMeeting(workspaceId: string, meetingId: string) {
  return prisma.govMeeting.findFirst({
    where: { id: meetingId, workspaceId },
    include: {
      items: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        include: { project: { select: { id: true, title: true, status: true, deadlineAt: true } } },
      },
      attendees: { orderBy: { name: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
}

export type MeetingDetail = NonNullable<Awaited<ReturnType<typeof getMeeting>>>;

// ─── Portal del socio ────────────────────────────────────────────────────────

/** Lo que el socio ve de Gobierno: sus propuestas y los proyectos que la comisión hizo visibles. */
export async function loadMemberProjects(workspaceId: string, memberId: string) {
  const [propias, visibles] = await Promise.all([
    prisma.govProject.findMany({
      where: { workspaceId, proposedByMemberId: memberId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        statusReason: true,
        visibleToMembers: true,
        createdAt: true,
        attachments: { where: { taskUpdateId: null, quoteId: null }, select: { id: true, filename: true, sizeBytes: true } },
      },
    }),
    prisma.govProject.findMany({
      where: { workspaceId, visibleToMembers: true, status: { notIn: ["MEMBER_PROPOSAL", "ARCHIVED"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        deadlineAt: true,
        description: true,
        tasks: { select: { status: true } },
      },
    }),
  ]);
  return { propias, visibles };
}

/** Un proyecto visible, con lo que el socio puede ver: etapas, avance, total de votos y archivos visibles. */
export async function getVisibleProject(workspaceId: string, projectId: string, memberId: string) {
  return prisma.govProject.findFirst({
    where: {
      id: projectId,
      workspaceId,
      OR: [{ visibleToMembers: true, status: { notIn: ["MEMBER_PROPOSAL", "ARCHIVED"] } }, { proposedByMemberId: memberId }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      statusReason: true,
      deadlineAt: true,
      visibleToMembers: true,
      proposedByMemberId: true,
      stages: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, tasks: { orderBy: { order: "asc" }, select: { id: true, title: true, status: true } } },
      },
      attachments: {
        where: { quoteId: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, filename: true, sizeBytes: true, visibleToMembers: true, taskUpdateId: true },
      },
    },
  });
}

export async function listMemberTasks(workspaceId: string, memberId: string) {
  const rows = await prisma.govProjectTask.findMany({
    where: { assigneeMemberId: memberId, project: { workspaceId, status: { notIn: ["ARCHIVED", "REJECTED", "CANCELLED"] } } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      stage: { select: { title: true } },
      project: { select: { id: true, title: true, status: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    status: r.status as TaskStatus,
    project: { ...r.project, status: r.project.status as ProjectStatus },
  }));
}

/** Una tarea del socio: sólo si es suya. Del proyecto se ve el título y la etapa, nada más. */
export async function getMemberTask(workspaceId: string, memberId: string, taskId: string) {
  const t = await prisma.govProjectTask.findFirst({
    where: { id: taskId, assigneeMemberId: memberId, project: { workspaceId } },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      notDoneReason: true,
      dueAt: true,
      closedAt: true,
      stage: { select: { title: true } },
      project: { select: { id: true, title: true, status: true } },
      updates: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          body: true,
          authorLabel: true,
          createdAt: true,
          attachments: { select: { id: true, filename: true, sizeBytes: true } },
        },
      },
    },
  });
  return t
    ? { ...t, status: t.status as TaskStatus, project: { ...t.project, status: t.project.status as ProjectStatus } }
    : null;
}

/** Estados de proyecto en los que una tarea suelta puede tomarla un socio voluntario. */
const VOLUNTARIADO: ProjectStatus[] = ["PROPOSED", "IN_REVIEW", "POSTPONED", "APPROVED", "IN_PROGRESS"];

/**
 * Tareas sin responsable que cualquier socio puede tomar ("¡necesitamos tu ayuda!").
 *
 * Sólo de proyectos que la comisión hizo visibles para socios: lo interno no se ofrece. Ordenadas
 * por fecha (lo que vence antes primero; sin fecha al final).
 */
export async function listOpenTasksForVolunteers(workspaceId: string, take?: number) {
  const where = {
    assigneeMemberId: null,
    status: { in: ["PENDING", "IN_PROGRESS"] },
    project: { workspaceId, visibleToMembers: true, status: { in: VOLUNTARIADO } },
  };
  const [rows, total] = await Promise.all([
    prisma.govProjectTask.findMany({
      where,
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take,
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        stage: { select: { title: true } },
        project: { select: { id: true, title: true } },
      },
    }),
    prisma.govProjectTask.count({ where }),
  ]);
  return { tasks: rows, total };
}

/** La condición de "se puede tomar", para repetirla al escribir y no confiar en lo que se mostró. */
export function volunteerableTaskWhere(workspaceId: string, taskId: string) {
  return {
    id: taskId,
    assigneeMemberId: null,
    status: { in: ["PENDING", "IN_PROGRESS"] },
    project: { workspaceId, visibleToMembers: true, status: { in: VOLUNTARIADO } },
  };
}
