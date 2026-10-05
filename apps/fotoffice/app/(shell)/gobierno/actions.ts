"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import {
  actorLabel,
  canWorkOnTask,
  requireGovernanceManager,
  requireGovernanceViewer,
} from "@/lib/governance/access";
import { recordProjectEvent } from "@/lib/governance/events";
import {
  parseNewProjectForm,
  parseProgressNote,
  parseProjectForm,
  parseStageTitle,
  parseStatusChange,
  parseTaskForm,
  parseTaskStatus,
  validateStatusChange,
} from "@/lib/governance/forms";
import { allowedTaskStatuses, canEditStructure } from "@/lib/governance/lifecycle";
import { memberBelongs } from "@/lib/governance/repository";
import { stagesCreateInput } from "@/lib/governance/seed";
import { parseStagesText } from "@/lib/governance/templates";
import { verifyGovernanceUpload } from "@/lib/governance/files";
import { safeFilename } from "@/lib/governance/file-names";
import type { ProjectStatus, TaskStatus } from "@/lib/governance/constants";
import { toDateInputValue } from "@/lib/governance/forms";

/**
 * Las acciones del módulo de proyectos de la comisión.
 *
 * Todas empiezan por una guarda de `lib/governance/access.ts`, y ninguna decide si algo es válido:
 * eso lo resuelven los módulos puros (`forms.ts`, `lifecycle.ts`). Cada cambio deja su evento en
 * el historial dentro de la misma transacción.
 */

const LISTA = "/gobierno";
const detalle = (id: string) => `${LISTA}/${id}`;
const tarea = (projectId: string, taskId: string) => `${detalle(projectId)}/tareas/${taskId}`;

function conError(destino: string, error: string): never {
  const sep = destino.includes("?") ? "&" : "?";
  redirect(`${destino}${sep}error=${encodeURIComponent(error)}`);
}

function conOk(destino: string, ok: string): never {
  const sep = destino.includes("?") ? "&" : "?";
  redirect(`${destino}${sep}ok=${encodeURIComponent(ok)}`);
}

/** Adónde volver después de una acción. Sólo dentro del módulo: nunca una dirección ajena. */
function volverA(fd: FormData, porDefecto: string): string {
  const pedido = String(fd.get("returnTo") ?? "");
  if (!/^\/gobierno(\/[\w-]*)*(\?[\w=&%.-]*)?$/.test(pedido)) return porDefecto;
  const [ruta, consulta = ""] = pedido.split("?");
  const params = new URLSearchParams(consulta);
  params.delete("ok");
  params.delete("error");
  const resto = params.toString();
  return resto ? `${ruta}?${resto}` : ruta!;
}

const campo = (fd: FormData, nombre: string) => String(fd.get(nombre) ?? "").trim();

async function proyectoDe(workspaceId: string, projectId: string) {
  const p = await prisma.govProject.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, status: true, title: true },
  });
  return p ? { ...p, status: p.status as ProjectStatus } : null;
}

async function exigirSocio(workspaceId: string, memberId: string | null, destino: string): Promise<string | null> {
  if (!memberId) return null;
  const socio = await memberBelongs(workspaceId, memberId);
  if (!socio) conError(destino, "Esa persona no es de esta institución.");
  return socio.name;
}

// ─── Proyectos ───────────────────────────────────────────────────────────────

export async function createProjectAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const nuevo = `${LISTA}/nuevo`;
  const parsed = parseNewProjectForm(fd);
  if (!parsed.ok) conError(nuevo, parsed.error);
  const v = parsed.values;
  await exigirSocio(workspace.id, v.responsibleMemberId, nuevo);

  const tipo = v.typeId
    ? await prisma.govProjectType.findFirst({
        where: { id: v.typeId, workspaceId: workspace.id },
        include: { stages: { orderBy: { order: "asc" }, include: { tasks: { orderBy: { order: "asc" } } } } },
      })
    : null;
  if (v.typeId && !tipo) conError(nuevo, "Ese tipo de proyecto no existe.");

  const proyecto = await prisma.$transaction(async (tx) => {
    const p = await tx.govProject.create({
      data: {
        workspaceId: workspace.id,
        typeId: tipo?.id ?? null,
        title: v.title,
        description: v.description,
        status: v.initialStatus,
        origin: "COMMISSION",
        responsibleMemberId: v.responsibleMemberId,
        deadlineAt: v.deadlineAt,
        visibleToMembers: v.visibleToMembers,
        createdByUserId: user.id,
        // Las etapas y tareas del tipo se COPIAN: desde acá el proyecto es independiente.
        stages: {
          create: (tipo?.stages ?? []).map((s, i) => ({
            title: s.title,
            order: i,
          })),
        },
      },
      select: { id: true, stages: { select: { id: true, order: true } } },
    });
    // Las tareas necesitan el id del proyecto además del de la etapa: van en un segundo paso.
    const etapaPorOrden = new Map(p.stages.map((s) => [s.order, s.id]));
    const tareas = (tipo?.stages ?? []).flatMap((s, i) =>
      s.tasks.map((t, j) => ({ projectId: p.id, stageId: etapaPorOrden.get(i)!, title: t.title, order: j })),
    );
    if (tareas.length > 0) await tx.govProjectTask.createMany({ data: tareas });
    await recordProjectEvent(tx, {
      projectId: p.id,
      type: "CREATED",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { initialStatus: v.initialStatus, type: tipo?.name ?? null },
    });
    return p;
  });

  revalidatePath(LISTA);
  redirect(detalle(proyecto.id));
}

const CAMPOS: Record<string, string> = {
  title: "el título",
  description: "la descripción",
  responsibleMemberId: "el responsable",
  deadlineAt: "la fecha límite",
  visibleToMembers: "la visibilidad para socios",
};

export async function updateProjectAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const actual = await prisma.govProject.findFirst({ where: { id: projectId, workspaceId: workspace.id } });
  if (!actual) conError(LISTA, "Ese proyecto no existe.");
  const parsed = parseProjectForm(fd);
  if (!parsed.ok) conError(detalle(projectId), parsed.error);
  const v = parsed.values;
  await exigirSocio(workspace.id, v.responsibleMemberId, detalle(projectId));

  const cambiados: string[] = [];
  if (v.title !== actual.title) cambiados.push(CAMPOS.title!);
  if ((v.description ?? null) !== (actual.description ?? null)) cambiados.push(CAMPOS.description!);
  if (v.responsibleMemberId !== actual.responsibleMemberId) cambiados.push(CAMPOS.responsibleMemberId!);
  if (toDateInputValue(v.deadlineAt) !== toDateInputValue(actual.deadlineAt)) cambiados.push(CAMPOS.deadlineAt!);
  if (v.visibleToMembers !== actual.visibleToMembers) cambiados.push(CAMPOS.visibleToMembers!);
  if (cambiados.length === 0) conOk(detalle(projectId), "sin-cambios");

  await prisma.$transaction(async (tx) => {
    await tx.govProject.update({ where: { id: actual.id }, data: v });
    await recordProjectEvent(tx, {
      projectId: actual.id,
      type: "UPDATED",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { fields: cambiados },
    });
  });
  revalidatePath(detalle(projectId));
  conOk(detalle(projectId), "guardado");
}

export async function changeProjectStatusAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const proyecto = await proyectoDe(workspace.id, projectId);
  if (!proyecto) conError(LISTA, "Ese proyecto no existe.");
  const parsed = parseStatusChange(fd);
  if (!parsed.ok) conError(detalle(projectId), parsed.error);
  const v = parsed.values;
  const problema = validateStatusChange(proyecto.status, v);
  if (problema) conError(detalle(projectId), problema);

  await prisma.$transaction(async (tx) => {
    // Compare-and-set: si otra persona ya lo movió, no se pisa su decisión.
    const r = await tx.govProject.updateMany({
      where: { id: proyecto.id, status: proyecto.status },
      data: { status: v.to, ...(v.reason ? { statusReason: v.reason } : {}) },
    });
    if (r.count === 0) throw new Error("CAMBIO_CONCURRENTE");
    await recordProjectEvent(tx, {
      projectId: proyecto.id,
      type: "STATUS_CHANGED",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: {
        from: proyecto.status,
        to: v.to,
        reason: v.reason,
        decidedOn: v.decidedOn ? toDateInputValue(v.decidedOn) : null,
        decision: v.decision,
      },
    });
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message === "CAMBIO_CONCURRENTE") {
      conError(detalle(projectId), "Alguien cambió el estado recién. Mirá cómo quedó y volvé a intentar.");
    }
    throw e;
  });

  revalidatePath(LISTA);
  revalidatePath(detalle(projectId));
  conOk(detalle(projectId), "estado");
}

export async function addProjectNoteAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const proyecto = await proyectoDe(workspace.id, projectId);
  if (!proyecto) conError(LISTA, "Ese proyecto no existe.");
  const parsed = parseProgressNote(fd);
  if (!parsed.ok) conError(detalle(projectId), parsed.error);
  await recordProjectEvent(prisma, {
    projectId,
    type: "NOTE",
    actorUserId: user.id,
    actorLabel: actorLabel(user),
    data: { text: parsed.values.body },
  });
  revalidatePath(detalle(projectId));
  conOk(detalle(projectId), "nota");
}

// ─── Etapas ──────────────────────────────────────────────────────────────────

async function proyectoEditable(workspaceId: string, projectId: string) {
  const proyecto = await proyectoDe(workspaceId, projectId);
  if (!proyecto) conError(LISTA, "Ese proyecto no existe.");
  if (!canEditStructure(proyecto.status)) {
    conError(detalle(projectId), "En este estado ya no se cambian etapas ni tareas.");
  }
  return proyecto;
}

export async function addStageAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  await proyectoEditable(workspace.id, projectId);
  const parsed = parseStageTitle(fd);
  if (!parsed.ok) conError(detalle(projectId), parsed.error);
  const ultima = await prisma.govProjectStage.aggregate({ where: { projectId }, _max: { order: true } });
  await prisma.$transaction(async (tx) => {
    await tx.govProjectStage.create({
      data: { projectId, title: parsed.values.title, order: (ultima._max.order ?? -1) + 1 },
    });
    await recordProjectEvent(tx, {
      projectId,
      type: "STAGE_ADDED",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { title: parsed.values.title },
    });
  });
  revalidatePath(detalle(projectId));
  redirect(`${detalle(projectId)}#etapas`);
}

async function etapaDe(projectId: string, stageId: string) {
  return prisma.govProjectStage.findFirst({
    where: { id: stageId, projectId },
    select: { id: true, title: true, order: true, _count: { select: { tasks: true } } },
  });
}

export async function renameStageAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  await proyectoEditable(workspace.id, projectId);
  const etapa = await etapaDe(projectId, campo(fd, "stageId"));
  if (!etapa) conError(detalle(projectId), "Esa etapa no existe.");
  const parsed = parseStageTitle(fd);
  if (!parsed.ok) conError(detalle(projectId), parsed.error);
  if (parsed.values.title === etapa.title) redirect(`${detalle(projectId)}#etapas`);
  await prisma.$transaction(async (tx) => {
    await tx.govProjectStage.update({ where: { id: etapa.id }, data: { title: parsed.values.title } });
    await recordProjectEvent(tx, {
      projectId,
      type: "STAGE_RENAMED",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { from: etapa.title, to: parsed.values.title },
    });
  });
  revalidatePath(detalle(projectId));
  redirect(`${detalle(projectId)}#etapas`);
}

/** Subir o bajar una etapa. Se intercambia el orden con la vecina. */
export async function moveStageAction(fd: FormData): Promise<void> {
  const { workspace } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  await proyectoEditable(workspace.id, projectId);
  const direccion = campo(fd, "direction") === "up" ? -1 : 1;
  const etapas = await prisma.govProjectStage.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const i = etapas.findIndex((e) => e.id === campo(fd, "stageId"));
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= etapas.length) redirect(`${detalle(projectId)}#etapas`);
  const orden = etapas.map((e) => e.id);
  [orden[i], orden[j]] = [orden[j]!, orden[i]!];
  await prisma.$transaction(orden.map((id, k) => prisma.govProjectStage.update({ where: { id }, data: { order: k } })));
  revalidatePath(detalle(projectId));
  redirect(`${detalle(projectId)}#etapas`);
}

/** Sólo una etapa vacía: lo que tiene tareas ya es parte de la historia del proyecto. */
export async function removeStageAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  await proyectoEditable(workspace.id, projectId);
  const etapa = await etapaDe(projectId, campo(fd, "stageId"));
  if (!etapa) conError(detalle(projectId), "Esa etapa no existe.");
  if (etapa._count.tasks > 0) conError(detalle(projectId), "Sólo se quita una etapa sin tareas.");
  await prisma.$transaction(async (tx) => {
    await tx.govProjectStage.delete({ where: { id: etapa.id } });
    await recordProjectEvent(tx, {
      projectId,
      type: "STAGE_REMOVED",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { title: etapa.title },
    });
  });
  revalidatePath(detalle(projectId));
  redirect(`${detalle(projectId)}#etapas`);
}

// ─── Tareas ──────────────────────────────────────────────────────────────────

export async function addTaskAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  await proyectoEditable(workspace.id, projectId);
  const etapa = await etapaDe(projectId, campo(fd, "stageId"));
  if (!etapa) conError(detalle(projectId), "Esa etapa no existe.");
  const parsed = parseTaskForm(fd);
  if (!parsed.ok) conError(detalle(projectId), parsed.error);
  const v = parsed.values;
  const responsable = await exigirSocio(workspace.id, v.assigneeMemberId, detalle(projectId));
  const ultima = await prisma.govProjectTask.aggregate({ where: { stageId: etapa.id }, _max: { order: true } });

  await prisma.$transaction(async (tx) => {
    const t = await tx.govProjectTask.create({
      data: { projectId, stageId: etapa.id, ...v, order: (ultima._max.order ?? -1) + 1 },
      select: { id: true },
    });
    await recordProjectEvent(tx, {
      projectId,
      type: "TASK_CREATED",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { title: v.title, stage: etapa.title },
      taskId: t.id,
    });
    if (responsable) {
      await recordProjectEvent(tx, {
        projectId,
        type: "TASK_ASSIGNED",
        actorUserId: user.id,
        actorLabel: actorLabel(user),
        data: { title: v.title, assignee: responsable },
        taskId: t.id,
      });
    }
  });
  revalidatePath(detalle(projectId));
  redirect(`${detalle(projectId)}#etapa-${etapa.id}`);
}

async function tareaDe(workspaceId: string, projectId: string, taskId: string) {
  const t = await prisma.govProjectTask.findFirst({
    where: { id: taskId, projectId, project: { workspaceId } },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      assigneeMemberId: true,
      dueAt: true,
      project: { select: { id: true, status: true } },
      _count: { select: { updates: true } },
    },
  });
  return t
    ? { ...t, status: t.status as TaskStatus, project: { ...t.project, status: t.project.status as ProjectStatus } }
    : null;
}

export async function updateTaskAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const taskId = campo(fd, "taskId");
  const destino = volverA(fd, tarea(projectId, taskId));
  const actual = await tareaDe(workspace.id, projectId, taskId);
  if (!actual) conError(detalle(projectId), "Esa tarea no existe.");
  if (!canEditStructure(actual.project.status)) conError(destino, "En este estado ya no se cambian las tareas.");
  const parsed = parseTaskForm(fd);
  if (!parsed.ok) conError(destino, parsed.error);
  const v = parsed.values;
  const responsable = await exigirSocio(workspace.id, v.assigneeMemberId, destino);

  const cambioDatos =
    v.title !== actual.title ||
    (v.description ?? null) !== (actual.description ?? null) ||
    toDateInputValue(v.dueAt) !== toDateInputValue(actual.dueAt);
  const cambioResponsable = v.assigneeMemberId !== actual.assigneeMemberId;
  if (!cambioDatos && !cambioResponsable) conOk(destino, "sin-cambios");

  await prisma.$transaction(async (tx) => {
    await tx.govProjectTask.update({ where: { id: actual.id }, data: v });
    if (cambioDatos) {
      await recordProjectEvent(tx, {
        projectId,
        type: "TASK_UPDATED",
        actorUserId: user.id,
        actorLabel: actorLabel(user),
        data: { title: v.title },
        taskId: actual.id,
      });
    }
    if (cambioResponsable) {
      await recordProjectEvent(tx, {
        projectId,
        type: "TASK_ASSIGNED",
        actorUserId: user.id,
        actorLabel: actorLabel(user),
        data: { title: v.title, assignee: responsable },
        taskId: actual.id,
      });
    }
  });
  revalidatePath(detalle(projectId));
  revalidatePath(tarea(projectId, taskId));
  conOk(destino, "guardado");
}

export async function setTaskStatusAction(fd: FormData): Promise<void> {
  const ctx = await requireGovernanceViewer();
  const { workspace, user } = ctx;
  const projectId = campo(fd, "projectId");
  const taskId = campo(fd, "taskId");
  const destino = volverA(fd, tarea(projectId, taskId));
  const actual = await tareaDe(workspace.id, projectId, taskId);
  if (!actual) conError(detalle(projectId), "Esa tarea no existe.");
  if (!canWorkOnTask(ctx, actual)) conError(destino, "Sólo el responsable o quien gestiona proyectos cambia esta tarea.");
  const parsed = parseTaskStatus(fd);
  if (!parsed.ok) conError(destino, parsed.error);
  const { status, reason } = parsed.values;
  if (status === actual.status) conOk(destino, "sin-cambios");
  if (!allowedTaskStatuses(actual.project.status).includes(status)) {
    conError(
      destino,
      status === "DONE" || status === "NOT_DONE"
        ? "Las tareas se dan por cerradas cuando el proyecto ya está aprobado."
        : "En este estado del proyecto ya no se cambian las tareas.",
    );
  }
  const cierra = status === "DONE" || status === "NOT_DONE";
  await prisma.$transaction(async (tx) => {
    await tx.govProjectTask.update({
      where: { id: actual.id },
      data: {
        status,
        notDoneReason: status === "NOT_DONE" ? reason : null,
        closedAt: cierra ? new Date() : null,
      },
    });
    await recordProjectEvent(tx, {
      projectId,
      type: "TASK_STATUS",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { title: actual.title, from: actual.status, to: status, reason },
      taskId: actual.id,
    });
  });
  revalidatePath(detalle(projectId));
  revalidatePath(tarea(projectId, taskId));
  revalidatePath(`${LISTA}/tareas`);
  conOk(destino, "tarea");
}

/** Sólo una tarea sin avances: la que ya tiene historia se marca "No se hizo", no se borra. */
export async function removeTaskAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const actual = await tareaDe(workspace.id, projectId, campo(fd, "taskId"));
  if (!actual) conError(detalle(projectId), "Esa tarea no existe.");
  if (!canEditStructure(actual.project.status)) conError(detalle(projectId), "En este estado ya no se quitan tareas.");
  if (actual._count.updates > 0 || actual.status === "DONE") {
    conError(tarea(projectId, actual.id), "Esta tarea ya tiene historia: marcala como «No se hizo», con el motivo.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.govProjectTask.delete({ where: { id: actual.id } });
    await recordProjectEvent(tx, {
      projectId,
      type: "TASK_REMOVED",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { title: actual.title },
    });
  });
  revalidatePath(detalle(projectId));
  redirect(`${detalle(projectId)}#etapas`);
}

// ─── Avances y archivos (llamadas desde componentes de cliente) ──────────────

type Resultado = { ok: true } | { ok: false; error: string };
type ArchivoSubido = { key: string; filename: string };

/** Registra los archivos ya subidos a R2. Verifica cada uno contra el bucket antes de guardarlo. */
async function registrarArchivos(
  tx: Prisma.TransactionClient,
  params: {
    workspaceId: string;
    projectId: string;
    taskUpdateId: string | null;
    userId: number;
    actor: string;
    verificados: { key: string; filename: string; sizeBytes: number; contentType: string }[];
  },
) {
  for (const a of params.verificados) {
    await tx.govAttachment.create({
      data: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        taskUpdateId: params.taskUpdateId,
        r2Key: a.key,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        uploadedByUserId: params.userId,
      },
    });
    await recordProjectEvent(tx, {
      projectId: params.projectId,
      type: "FILE_ADDED",
      actorUserId: params.userId,
      actorLabel: params.actor,
      data: { filename: a.filename },
    });
  }
}

async function verificarTodos(
  workspaceId: string,
  projectId: string,
  archivos: readonly ArchivoSubido[],
): Promise<{ ok: true; verificados: { key: string; filename: string; sizeBytes: number; contentType: string }[] } | { ok: false; error: string }> {
  if (archivos.length > 20) return { ok: false, error: "Hasta 20 archivos por vez." };
  const verificados = [];
  for (const a of archivos) {
    const r = await verifyGovernanceUpload(String(a.key), workspaceId, projectId);
    if (!r.ok) return { ok: false, error: `${safeFilename(String(a.filename))}: ${r.error}` };
    verificados.push({ key: String(a.key), filename: safeFilename(String(a.filename)), sizeBytes: r.sizeBytes, contentType: r.contentType });
  }
  return { ok: true, verificados };
}

export async function registerProjectFilesAction(input: { projectId: string; files: ArchivoSubido[] }): Promise<Resultado> {
  const { workspace, user } = await requireGovernanceManager();
  const proyecto = await proyectoDe(workspace.id, String(input.projectId));
  if (!proyecto) return { ok: false, error: "Ese proyecto no existe." };
  const v = await verificarTodos(workspace.id, proyecto.id, input.files ?? []);
  if (!v.ok) return v;
  await prisma.$transaction(async (tx) => {
    await registrarArchivos(tx, {
      workspaceId: workspace.id,
      projectId: proyecto.id,
      taskUpdateId: null,
      userId: user.id,
      actor: actorLabel(user),
      verificados: v.verificados,
    });
  });
  revalidatePath(detalle(proyecto.id));
  return { ok: true };
}

export async function addTaskProgressAction(input: {
  projectId: string;
  taskId: string;
  body: string;
  files: ArchivoSubido[];
}): Promise<Resultado> {
  const ctx = await requireGovernanceViewer();
  const { workspace, user } = ctx;
  const actual = await tareaDe(workspace.id, String(input.projectId), String(input.taskId));
  if (!actual) return { ok: false, error: "Esa tarea no existe." };
  if (!canWorkOnTask(ctx, actual)) return { ok: false, error: "Sólo el responsable o quien gestiona proyectos carga avances." };
  const fd = new FormData();
  fd.set("body", String(input.body ?? ""));
  const nota = parseProgressNote(fd);
  if (!nota.ok) return nota;
  const v = await verificarTodos(workspace.id, actual.project.id, input.files ?? []);
  if (!v.ok) return v;

  await prisma.$transaction(async (tx) => {
    const u = await tx.govTaskUpdate.create({
      data: { taskId: actual.id, body: nota.values.body, authorUserId: user.id, authorLabel: actorLabel(user) },
      select: { id: true },
    });
    await recordProjectEvent(tx, {
      projectId: actual.project.id,
      type: "TASK_PROGRESS",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { title: actual.title },
      taskId: actual.id,
    });
    await registrarArchivos(tx, {
      workspaceId: workspace.id,
      projectId: actual.project.id,
      taskUpdateId: u.id,
      userId: user.id,
      actor: actorLabel(user),
      verificados: v.verificados,
    });
  });
  revalidatePath(tarea(actual.project.id, actual.id));
  revalidatePath(detalle(actual.project.id));
  return { ok: true };
}

export async function setFileVisibilityAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const destino = volverA(fd, detalle(projectId));
  const archivo = await prisma.govAttachment.findFirst({
    where: { id: campo(fd, "attachmentId"), projectId, workspaceId: workspace.id },
    select: { id: true, filename: true, visibleToMembers: true },
  });
  if (!archivo) conError(destino, "Ese archivo no existe.");
  const visible = campo(fd, "visible") === "1";
  if (visible === archivo.visibleToMembers) redirect(destino);
  await prisma.$transaction(async (tx) => {
    await tx.govAttachment.update({ where: { id: archivo.id }, data: { visibleToMembers: visible } });
    await recordProjectEvent(tx, {
      projectId,
      type: "FILE_VISIBILITY",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { filename: archivo.filename, visible },
    });
  });
  revalidatePath(destino);
  redirect(destino);
}

// ─── Tipos de proyecto ───────────────────────────────────────────────────────

const TIPOS = `${LISTA}/tipos`;

export async function saveProjectTypeAction(fd: FormData): Promise<void> {
  const { workspace } = await requireGovernanceManager();
  const typeId = campo(fd, "typeId") || null;
  const destino = typeId ? `${TIPOS}/${typeId}` : TIPOS;
  const name = campo(fd, "name");
  if (name === "") conError(destino, "Poné un nombre.");
  if (name.length > 120) conError(destino, "El nombre es demasiado largo.");
  const description = campo(fd, "description") || null;
  const etapas = parseStagesText(String(fd.get("stagesText") ?? ""));
  if (!etapas.ok) conError(destino, etapas.error);

  const repetido = await prisma.govProjectType.findFirst({
    where: { workspaceId: workspace.id, name, ...(typeId ? { NOT: { id: typeId } } : {}) },
    select: { id: true },
  });
  if (repetido) conError(destino, "Ya hay un tipo con ese nombre.");

  if (typeId) {
    const actual = await prisma.govProjectType.findFirst({ where: { id: typeId, workspaceId: workspace.id } });
    if (!actual) conError(TIPOS, "Ese tipo no existe.");
    // La plantilla no es historia: los proyectos ya creados tienen su propia copia.
    await prisma.$transaction([
      prisma.govProjectTypeStage.deleteMany({ where: { typeId } }),
      prisma.govProjectType.update({
        where: { id: typeId },
        data: { name, description, stages: { create: stagesCreateInput(etapas.stages) } },
      }),
    ]);
  } else {
    const ultimo = await prisma.govProjectType.aggregate({ where: { workspaceId: workspace.id }, _max: { order: true } });
    await prisma.govProjectType.create({
      data: {
        workspaceId: workspace.id,
        name,
        description,
        order: (ultimo._max.order ?? -1) + 1,
        stages: { create: stagesCreateInput(etapas.stages) },
      },
    });
  }
  revalidatePath(TIPOS);
  conOk(TIPOS, "tipo");
}

export async function archiveProjectTypeAction(fd: FormData): Promise<void> {
  const { workspace } = await requireGovernanceManager();
  const typeId = campo(fd, "typeId");
  const archivar = campo(fd, "archive") === "1";
  const r = await prisma.govProjectType.updateMany({
    where: { id: typeId, workspaceId: workspace.id },
    data: { archivedAt: archivar ? new Date() : null },
  });
  if (r.count === 0) conError(TIPOS, "Ese tipo no existe.");
  revalidatePath(TIPOS);
  conOk(TIPOS, archivar ? "archivado" : "restaurado");
}
