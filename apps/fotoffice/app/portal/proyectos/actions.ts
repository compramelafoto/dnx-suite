"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { loadPortalGovernance, requirePortalGovernance } from "@/lib/governance/portal-access";
import { recordProjectEvent } from "@/lib/governance/events";
import { parseProposal } from "@/lib/governance/proposals";
import { parseProgressNote, parseTaskStatus } from "@/lib/governance/forms";
import { allowedTaskStatuses } from "@/lib/governance/lifecycle";
import { verifyGovernanceUpload } from "@/lib/governance/files";
import { safeFilename } from "@/lib/governance/file-names";
import type { ProjectStatus, TaskStatus } from "@/lib/governance/constants";
import { volunteerableTaskWhere } from "@/lib/governance/repository";

/**
 * Lo que el socio hace en Gobierno desde su portal: proponer un proyecto (con archivos) y cumplir
 * sus tareas. Cada acción vuelve a comprobar que lo que toca es suyo.
 */

type Resultado = { ok: true } | { ok: false; error: string };
type ArchivoSubido = { key: string; filename: string };

async function verificar(workspaceId: string, projectId: string, files: readonly ArchivoSubido[]) {
  if (files.length > 10) return { ok: false as const, error: "Hasta 10 archivos por vez." };
  const out: { key: string; filename: string; sizeBytes: number; contentType: string }[] = [];
  for (const f of files) {
    const r = await verifyGovernanceUpload(String(f.key), workspaceId, projectId);
    if (!r.ok) return { ok: false as const, error: `${safeFilename(String(f.filename))}: ${r.error}` };
    out.push({ key: String(f.key), filename: safeFilename(String(f.filename)), sizeBytes: r.sizeBytes, contentType: r.contentType });
  }
  return { ok: true as const, files: out };
}

async function guardarArchivos(
  tx: Prisma.TransactionClient,
  p: { workspaceId: string; projectId: string; taskUpdateId: string | null; userId: number; actor: string },
  files: { key: string; filename: string; sizeBytes: number; contentType: string }[],
) {
  for (const f of files) {
    await tx.govAttachment.create({
      data: {
        workspaceId: p.workspaceId,
        projectId: p.projectId,
        taskUpdateId: p.taskUpdateId,
        r2Key: f.key,
        filename: f.filename,
        contentType: f.contentType,
        sizeBytes: f.sizeBytes,
        uploadedByUserId: p.userId,
      },
    });
    await recordProjectEvent(tx, {
      projectId: p.projectId,
      type: "FILE_ADDED",
      actorUserId: p.userId,
      actorLabel: p.actor,
      data: { filename: f.filename },
    });
  }
}

// ─── Propuestas ──────────────────────────────────────────────────────────────

/** Crea la propuesta. Los archivos se suben después, contra el proyecto ya creado. */
export async function submitProposalAction(input: {
  title: string;
  description: string;
  approxCost: string;
  deadline: string;
  fundingIdea: string;
  commitment: string;
}): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const ctx = await loadPortalGovernance();
  if (!ctx) return { ok: false, error: "No podés presentar propuestas en esta institución." };
  const parsed = parseProposal(input);
  if (!parsed.ok) return parsed;
  const v = parsed.values;

  // Un freno sencillo contra el doble clic y el abuso: hasta 5 propuestas abiertas por socio.
  const abiertas = await prisma.govProject.count({
    where: { workspaceId: ctx.workspace.id, proposedByMemberId: ctx.member.id, status: "MEMBER_PROPOSAL" },
  });
  if (abiertas >= 5) {
    return { ok: false, error: "Ya tenés 5 propuestas esperando respuesta. Cuando la comisión responda podés presentar otra." };
  }

  const p = await prisma.$transaction(async (tx) => {
    const creado = await tx.govProject.create({
      data: {
        workspaceId: ctx.workspace.id,
        title: v.title,
        description: v.description,
        status: "MEMBER_PROPOSAL",
        origin: "MEMBER_PROPOSAL",
        proposedByMemberId: ctx.member.id,
        manualNeededArs: v.approxCostArs,
        deadlineAt: v.deadlineAt,
        fundingIdea: v.fundingIdea,
        proposerCommitment: v.proposerCommitment,
        createdByUserId: ctx.user.id,
      },
      select: { id: true },
    });
    await recordProjectEvent(tx, {
      projectId: creado.id,
      type: "CREATED",
      actorUserId: ctx.user.id,
      actorLabel: ctx.actor,
      data: { initialStatus: "MEMBER_PROPOSAL" },
    });
    return creado;
  });
  revalidatePath("/portal/proyectos");
  revalidatePath("/gobierno");
  return { ok: true, projectId: p.id };
}

/** Archivos de la propia propuesta, mientras siga esperando respuesta. */
export async function registerProposalFilesAction(input: { projectId: string; files: ArchivoSubido[] }): Promise<Resultado> {
  const ctx = await loadPortalGovernance();
  if (!ctx) return { ok: false, error: "No podés adjuntar archivos acá." };
  const p = await prisma.govProject.findFirst({
    where: { id: String(input.projectId), workspaceId: ctx.workspace.id, proposedByMemberId: ctx.member.id, status: "MEMBER_PROPOSAL" },
    select: { id: true },
  });
  if (!p) return { ok: false, error: "Esa propuesta no existe o ya fue respondida." };
  const v = await verificar(ctx.workspace.id, p.id, input.files ?? []);
  if (!v.ok) return v;
  await prisma.$transaction(
    async (tx) =>
      guardarArchivos(tx, { workspaceId: ctx.workspace.id, projectId: p.id, taskUpdateId: null, userId: ctx.user.id, actor: ctx.actor }, v.files),
    { timeout: 20_000 },
  );
  revalidatePath(`/portal/proyectos/${p.id}`);
  return { ok: true };
}

// ─── Mis tareas ──────────────────────────────────────────────────────────────

async function tareaMia(workspaceId: string, memberId: string, taskId: string) {
  const t = await prisma.govProjectTask.findFirst({
    where: { id: taskId, assigneeMemberId: memberId, project: { workspaceId } },
    select: { id: true, title: true, status: true, project: { select: { id: true, status: true } } },
  });
  return t ? { ...t, status: t.status as TaskStatus, project: { ...t.project, status: t.project.status as ProjectStatus } } : null;
}

export async function memberTaskProgressAction(input: {
  projectId: string;
  taskId: string;
  body: string;
  files: ArchivoSubido[];
}): Promise<Resultado> {
  const ctx = await loadPortalGovernance();
  if (!ctx) return { ok: false, error: "No tenés acceso a esta tarea." };
  const t = await tareaMia(ctx.workspace.id, ctx.member.id, String(input.taskId));
  if (!t) return { ok: false, error: "Esa tarea no es tuya o ya no existe." };
  const fd = new FormData();
  fd.set("body", String(input.body ?? ""));
  const nota = parseProgressNote(fd);
  if (!nota.ok) return nota;
  const v = await verificar(ctx.workspace.id, t.project.id, input.files ?? []);
  if (!v.ok) return v;
  await prisma.$transaction(
    async (tx) => {
      const u = await tx.govTaskUpdate.create({
        data: { taskId: t.id, body: nota.values.body, authorUserId: ctx.user.id, authorLabel: ctx.actor },
        select: { id: true },
      });
      await recordProjectEvent(tx, {
        projectId: t.project.id,
        type: "TASK_PROGRESS",
        actorUserId: ctx.user.id,
        actorLabel: ctx.actor,
        data: { title: t.title },
        taskId: t.id,
      });
      await guardarArchivos(tx, { workspaceId: ctx.workspace.id, projectId: t.project.id, taskUpdateId: u.id, userId: ctx.user.id, actor: ctx.actor }, v.files);
    },
    { timeout: 20_000 },
  );
  revalidatePath(`/portal/tareas/${t.id}`);
  revalidatePath(`/gobierno/${t.project.id}`);
  return { ok: true };
}

export async function memberSetTaskStatusAction(fd: FormData): Promise<void> {
  const ctx = await requirePortalGovernance();
  const taskId = String(fd.get("taskId") ?? "");
  const destino = `/portal/tareas/${taskId}`;
  const t = await tareaMia(ctx.workspace.id, ctx.member.id, taskId);
  if (!t) redirect("/portal/tareas");
  const parsed = parseTaskStatus(fd);
  if (!parsed.ok) redirect(`${destino}?error=${encodeURIComponent(parsed.error)}`);
  const { status, reason } = parsed.values;
  if (status === t.status) redirect(destino);
  if (!allowedTaskStatuses(t.project.status).includes(status)) {
    redirect(`${destino}?error=${encodeURIComponent("Esta tarea se da por cerrada cuando el proyecto ya está aprobado.")}`);
  }
  const cierra = status === "DONE" || status === "NOT_DONE";
  await prisma.$transaction(async (tx) => {
    await tx.govProjectTask.update({
      where: { id: t.id },
      data: { status, notDoneReason: status === "NOT_DONE" ? reason : null, closedAt: cierra ? new Date() : null },
    });
    await recordProjectEvent(tx, {
      projectId: t.project.id,
      type: "TASK_STATUS",
      actorUserId: ctx.user.id,
      actorLabel: ctx.actor,
      data: { title: t.title, from: t.status, to: status, reason },
      taskId: t.id,
    });
  });
  revalidatePath(destino);
  revalidatePath("/portal/tareas");
  revalidatePath(`/gobierno/${t.project.id}`);
  redirect(`${destino}?ok=1`);
}

// ─── Me ofrezco ──────────────────────────────────────────────────────────────

/**
 * El socio toma una tarea sin responsable. Se asigna en el acto: la comisión ve quién se ofreció
 * y puede reasignarla. La condición se vuelve a exigir al escribir, así dos socios que tocan a la
 * vez no se pisan: el segundo recibe "ya la tomó otra persona".
 */
export async function volunteerForTaskAction(fd: FormData): Promise<void> {
  const ctx = await requirePortalGovernance();
  const taskId = String(fd.get("taskId") ?? "");
  const tarea = await prisma.govProjectTask.findFirst({
    where: volunteerableTaskWhere(ctx.workspace.id, taskId),
    select: { id: true, title: true, projectId: true },
  });
  if (!tarea) redirect(`/portal/tareas?error=${encodeURIComponent("Esa tarea ya la tomó otra persona o ya no está disponible.")}#ayudar`);
  const tomada = await prisma.$transaction(async (tx) => {
    const r = await tx.govProjectTask.updateMany({
      where: volunteerableTaskWhere(ctx.workspace.id, tarea.id),
      data: { assigneeMemberId: ctx.member.id },
    });
    if (r.count === 0) return false;
    await recordProjectEvent(tx, {
      projectId: tarea.projectId,
      type: "TASK_ASSIGNED",
      actorUserId: ctx.user.id,
      actorLabel: ctx.actor,
      data: { title: tarea.title, assignee: ctx.actor, volunteered: true },
      taskId: tarea.id,
    });
    return true;
  });
  if (!tomada) redirect(`/portal/tareas?error=${encodeURIComponent("Esa tarea ya la tomó otra persona.")}#ayudar`);
  revalidatePath("/portal/tareas");
  revalidatePath("/portal");
  revalidatePath(`/gobierno/${tarea.projectId}`);
  redirect(`/portal/tareas/${tarea.id}?ok=ofrecida`);
}
