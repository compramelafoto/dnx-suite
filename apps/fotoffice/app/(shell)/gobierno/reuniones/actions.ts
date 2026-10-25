"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { actorLabel, requireGovernanceManager, requireGovernanceViewer } from "@/lib/governance/access";
import { recordProjectEvent } from "@/lib/governance/events";
import { toDateInputValue } from "@/lib/governance/forms";
import {
  AGENDA_STATUSES,
  canApplyOutcome,
  isItemOutcome,
  isMinutesLocked,
  moveInOrder,
  parseMeetingForm,
  targetStatusFor,
} from "@/lib/governance/meetings";
import { loadVoting } from "@/lib/governance/repository";
import { sortByPriority } from "@/lib/governance/urgency";
import { isVoteValue, isVotingOpen } from "@/lib/governance/votes";
import { listActiveOfficeHolders } from "@/lib/commission/terms";
import type { ProjectStatus } from "@/lib/governance/constants";

/**
 * Reuniones de comisión y votación (etapa 2 del diseño de Gobierno).
 *
 * El temario nace con los proyectos que esperan una decisión, ordenados por prioridad. Al tratar
 * un proyecto, lo resuelto cambia su estado, congela la votación de ese momento y queda en el
 * historial del proyecto con la fecha de la reunión. Aprobada el acta, nada se reescribe.
 */

const LISTA = "/gobierno/reuniones";
const detalle = (id: string) => `${LISTA}/${id}`;
const campo = (fd: FormData, n: string) => String(fd.get(n) ?? "").trim();

function conError(destino: string, error: string): never {
  redirect(`${destino}?error=${encodeURIComponent(error)}`);
}
function conOk(destino: string, ok: string): never {
  redirect(`${destino}?ok=${encodeURIComponent(ok)}`);
}

async function reunionDe(workspaceId: string, meetingId: string) {
  return prisma.govMeeting.findFirst({
    where: { id: meetingId, workspaceId },
    select: { id: true, status: true, title: true, scheduledAt: true },
  });
}

async function reunionEditable(workspaceId: string, meetingId: string) {
  const r = await reunionDe(workspaceId, meetingId);
  if (!r) conError(LISTA, "Esa reunión no existe.");
  if (isMinutesLocked(r.status)) conError(detalle(r.id), "El acta ya está aprobada: sólo se pueden agregar notas.");
  return r;
}

// ─── Reunión ─────────────────────────────────────────────────────────────────

export async function createMeetingAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const parsed = parseMeetingForm(fd);
  if (!parsed.ok) conError(LISTA, parsed.error);

  // El temario arranca con lo que espera una decisión, en orden de prioridad.
  const pendientes = await prisma.govProject.findMany({
    where: { workspaceId: workspace.id, status: { in: [...AGENDA_STATUSES] } },
    select: { id: true, title: true, status: true, deadlineAt: true, createdAt: true },
  });
  const votacion = await loadVoting(workspace.id, pendientes.map((p) => p.id));
  const ordenados = sortByPriority(
    pendientes.map((p) => ({ ...p, status: p.status as ProjectStatus })),
    new Date(),
    (p) => votacion.tallyOf(p.id).percentFor,
  );

  const reunion = await prisma.govMeeting.create({
    data: {
      workspaceId: workspace.id,
      ...parsed.values,
      createdByUserId: user.id,
      items: { create: ordenados.map((p, i) => ({ projectId: p.id, title: p.title, order: i })) },
    },
    select: { id: true },
  });
  revalidatePath(LISTA);
  redirect(detalle(reunion.id));
}

export async function updateMeetingAction(fd: FormData): Promise<void> {
  const { workspace } = await requireGovernanceManager();
  const r = await reunionEditable(workspace.id, campo(fd, "meetingId"));
  const parsed = parseMeetingForm(fd);
  if (!parsed.ok) conError(detalle(r.id), parsed.error);
  await prisma.govMeeting.update({ where: { id: r.id }, data: parsed.values });
  revalidatePath(detalle(r.id));
  conOk(detalle(r.id), "guardado");
}

export async function markMeetingHeldAction(fd: FormData): Promise<void> {
  const { workspace } = await requireGovernanceManager();
  const r = await reunionEditable(workspace.id, campo(fd, "meetingId"));
  if (r.status !== "PLANNED") conError(detalle(r.id), "La reunión ya figura como realizada.");
  await prisma.govMeeting.update({ where: { id: r.id }, data: { status: "HELD", heldAt: new Date() } });
  revalidatePath(detalle(r.id));
  conOk(detalle(r.id), "realizada");
}

export async function approveMinutesAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const r = await reunionEditable(workspace.id, campo(fd, "meetingId"));
  if (r.status !== "HELD") conError(detalle(r.id), "Primero marcá la reunión como realizada.");
  const sinTratar = await prisma.govMeetingItem.count({ where: { meetingId: r.id, treatedAt: null } });
  if (sinTratar > 0) {
    conError(detalle(r.id), "Hay temas sin tratar: escribí qué se resolvió o quitalos del temario antes de aprobar el acta.");
  }
  const presentes = await prisma.govMeetingAttendee.count({ where: { meetingId: r.id } });
  if (presentes === 0) conError(detalle(r.id), "Marcá quiénes estuvieron antes de aprobar el acta.");
  await prisma.govMeeting.update({
    where: { id: r.id },
    data: { status: "MINUTES_APPROVED", minutesApprovedAt: new Date(), minutesApprovedByUserId: user.id },
  });
  revalidatePath(detalle(r.id));
  conOk(detalle(r.id), "acta");
}

export async function addMeetingNoteAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const r = await reunionDe(workspace.id, campo(fd, "meetingId"));
  if (!r) conError(LISTA, "Esa reunión no existe.");
  const body = campo(fd, "body");
  if (!body) conError(detalle(r.id), "Escribí la nota.");
  if (body.length > 10_000) conError(detalle(r.id), "La nota es demasiado larga.");
  await prisma.govMeetingNote.create({ data: { meetingId: r.id, body, authorUserId: user.id, authorLabel: actorLabel(user) } });
  revalidatePath(detalle(r.id));
  conOk(detalle(r.id), "nota");
}

/** Quiénes estuvieron: se eligen de la comisión vigente y se guarda una instantánea. */
export async function saveAttendeesAction(fd: FormData): Promise<void> {
  const { workspace } = await requireGovernanceManager();
  const r = await reunionEditable(workspace.id, campo(fd, "meetingId"));
  const elegidos = new Set(fd.getAll("termId").map(String));
  const holders = await listActiveOfficeHolders(workspace.id);
  // Una persona con dos cargos figura una vez, con los dos cargos juntos.
  const porPersona = new Map<string, { memberId: string | null; userId: number | null; name: string; offices: string[] }>();
  for (const h of holders) {
    if (!elegidos.has(h.termId)) continue;
    const clave = h.memberId ?? `u:${h.userId ?? h.termId}`;
    const actual = porPersona.get(clave);
    if (actual) actual.offices.push(h.officeName);
    else porPersona.set(clave, { memberId: h.memberId, userId: h.userId, name: h.displayName, offices: [h.officeName] });
  }
  const invitado = campo(fd, "guest");
  await prisma.$transaction([
    prisma.govMeetingAttendee.deleteMany({ where: { meetingId: r.id } }),
    prisma.govMeetingAttendee.createMany({
      data: [
        ...[...porPersona.values()].map((p) => ({
          meetingId: r.id,
          memberId: p.memberId,
          userId: p.userId,
          name: p.name,
          officeName: p.offices.join(" y "),
        })),
        ...invitado
          .split(/[\n,]/)
          .map((n) => n.trim())
          .filter(Boolean)
          .slice(0, 30)
          .map((name) => ({ meetingId: r.id, name: name.slice(0, 120), officeName: "Invitado/a" })),
      ],
    }),
  ]);
  revalidatePath(detalle(r.id));
  conOk(detalle(r.id), "asistentes");
}

// ─── Temario ─────────────────────────────────────────────────────────────────

export async function addAgendaItemAction(fd: FormData): Promise<void> {
  const { workspace } = await requireGovernanceManager();
  const r = await reunionEditable(workspace.id, campo(fd, "meetingId"));
  const projectId = campo(fd, "projectId") || null;
  let title = campo(fd, "title");
  if (projectId) {
    const p = await prisma.govProject.findFirst({ where: { id: projectId, workspaceId: workspace.id }, select: { title: true } });
    if (!p) conError(detalle(r.id), "Ese proyecto no existe.");
    const ya = await prisma.govMeetingItem.count({ where: { meetingId: r.id, projectId } });
    if (ya > 0) conError(detalle(r.id), "Ese proyecto ya está en el temario.");
    title = p.title;
  }
  if (!title) conError(detalle(r.id), "Escribí el tema.");
  if (title.length > 300) conError(detalle(r.id), "El tema es demasiado largo.");
  const ultimo = await prisma.govMeetingItem.aggregate({ where: { meetingId: r.id }, _max: { order: true } });
  await prisma.govMeetingItem.create({ data: { meetingId: r.id, projectId, title, order: (ultimo._max.order ?? -1) + 1 } });
  revalidatePath(detalle(r.id));
  redirect(`${detalle(r.id)}#temario`);
}

export async function moveAgendaItemAction(fd: FormData): Promise<void> {
  const { workspace } = await requireGovernanceManager();
  const r = await reunionEditable(workspace.id, campo(fd, "meetingId"));
  const items = await prisma.govMeetingItem.findMany({
    where: { meetingId: r.id },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const orden = moveInOrder(
    items.map((i) => i.id),
    campo(fd, "itemId"),
    campo(fd, "direction") === "up" ? "up" : "down",
  );
  if (orden) await prisma.$transaction(orden.map((id, k) => prisma.govMeetingItem.update({ where: { id }, data: { order: k } })));
  revalidatePath(detalle(r.id));
  redirect(`${detalle(r.id)}#temario`);
}

export async function removeAgendaItemAction(fd: FormData): Promise<void> {
  const { workspace } = await requireGovernanceManager();
  const r = await reunionEditable(workspace.id, campo(fd, "meetingId"));
  const item = await prisma.govMeetingItem.findFirst({ where: { id: campo(fd, "itemId"), meetingId: r.id } });
  if (!item) conError(detalle(r.id), "Ese tema no está en el temario.");
  if (item.treatedAt) conError(detalle(r.id), "Ese tema ya se trató: no se quita, se corrige lo resuelto.");
  await prisma.govMeetingItem.delete({ where: { id: item.id } });
  revalidatePath(detalle(r.id));
  redirect(`${detalle(r.id)}#temario`);
}

/**
 * Tratar un tema: lo que se resolvió y, si es un proyecto, el resultado. El resultado de un
 * proyecto se aplica una sola vez (cambia su estado y congela la votación); después sólo se
 * corrige el texto de lo decidido.
 */
export async function treatAgendaItemAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const r = await reunionEditable(workspace.id, campo(fd, "meetingId"));
  const item = await prisma.govMeetingItem.findFirst({
    where: { id: campo(fd, "itemId"), meetingId: r.id },
    include: { project: { select: { id: true, status: true, title: true } } },
  });
  if (!item) conError(detalle(r.id), "Ese tema no está en el temario.");
  const decisionText = campo(fd, "decisionText");
  if (!decisionText) conError(detalle(r.id), "Escribí qué se resolvió: es lo que va al acta.");
  if (decisionText.length > 10_000) conError(detalle(r.id), "El texto es demasiado largo.");

  // Tema suelto, o proyecto cuyo resultado ya se aplicó: sólo cambia el texto.
  if (!item.project || item.outcome) {
    await prisma.govMeetingItem.update({
      where: { id: item.id },
      data: { decisionText, treatedAt: item.treatedAt ?? new Date(), treatedByUserId: user.id },
    });
    revalidatePath(detalle(r.id));
    redirect(`${detalle(r.id)}#item-${item.id}`);
  }

  const outcome = campo(fd, "outcome");
  if (!isItemOutcome(outcome)) conError(detalle(r.id), "Elegí qué se resolvió sobre el proyecto.");
  const actual = item.project.status as ProjectStatus;
  if (!canApplyOutcome(outcome, actual)) {
    conError(detalle(r.id), "Ese resultado no corresponde al estado en que está el proyecto.");
  }
  const destino = targetStatusFor(outcome, actual);
  const votacion = await loadVoting(workspace.id, [item.project.id]);
  const foto = votacion.tallyOf(item.project.id);
  const projectId = item.project.id;
  const fechaReunion = toDateInputValue(r.scheduledAt);

  await prisma
    .$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.govMeetingItem.update({
          where: { id: item.id },
          data: { decisionText, outcome, voteSnapshot: foto, treatedAt: new Date(), treatedByUserId: user.id },
        });
        if (destino) {
          const cambio = await tx.govProject.updateMany({
            where: { id: projectId, status: actual },
            data: { status: destino, ...(destino === "REJECTED" ? { statusReason: decisionText } : {}) },
          });
          if (cambio.count === 0) throw new Error("CAMBIO_CONCURRENTE");
          await recordProjectEvent(tx, {
            projectId,
            type: "STATUS_CHANGED",
            actorUserId: user.id,
            actorLabel: actorLabel(user),
            data: {
              from: actual,
              to: destino,
              decidedOn: fechaReunion,
              decision: decisionText,
              meetingId: r.id,
              meetingTitle: r.title,
              votes: foto,
              ...(destino === "REJECTED" ? { reason: decisionText } : {}),
            },
          });
        } else {
          await recordProjectEvent(tx, {
            projectId,
            type: "NOTE",
            actorUserId: user.id,
            actorLabel: actorLabel(user),
            data: { text: `Tratado en «${r.title}»: ${decisionText}`, meetingId: r.id },
          });
        }
      },
      { timeout: 20_000 },
    )
    .catch((e: unknown) => {
      if (e instanceof Error && e.message === "CAMBIO_CONCURRENTE") {
        conError(detalle(r.id), "El proyecto cambió de estado recién. Mirá cómo quedó y volvé a intentar.");
      }
      throw e;
    });

  revalidatePath(detalle(r.id));
  revalidatePath(`/gobierno/${projectId}`);
  revalidatePath("/gobierno");
  redirect(`${detalle(r.id)}#item-${item.id}`);
}

// ─── Votación ────────────────────────────────────────────────────────────────

/** Votar o cambiar el voto. Sólo quien tiene un cargo vigente que vota, y mientras esté abierta. */
export async function castVoteAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceViewer();
  const projectId = campo(fd, "projectId");
  const destino = `/gobierno/${projectId}`;
  const p = await prisma.govProject.findFirst({ where: { id: projectId, workspaceId: workspace.id }, select: { id: true, status: true } });
  if (!p) conError("/gobierno", "Ese proyecto no existe.");
  if (!isVotingOpen(p.status as ProjectStatus)) conError(destino, "La votación de este proyecto ya está cerrada.");
  const valor = campo(fd, "value");
  if (!isVoteValue(valor)) conError(destino, "Ese voto no existe.");
  const { roll } = await loadVoting(workspace.id, []);
  if (!roll.userIds.has(user.id)) conError(destino, "Votan sólo quienes tienen un cargo con voto en la comisión.");

  const previo = await prisma.govVote.findUnique({ where: { projectId_voterUserId: { projectId: p.id, voterUserId: user.id } } });
  if (previo?.value === valor) redirect(`${destino}#votacion`);
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.govVote.upsert({
      where: { projectId_voterUserId: { projectId: p.id, voterUserId: user.id } },
      create: { projectId: p.id, voterUserId: user.id, value: valor },
      update: { value: valor },
    });
    await recordProjectEvent(tx, {
      projectId: p.id,
      type: "VOTED",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { value: valor, changed: Boolean(previo) },
    });
  });
  revalidatePath(destino);
  revalidatePath("/gobierno");
  redirect(`${destino}?ok=voto#votacion`);
}
