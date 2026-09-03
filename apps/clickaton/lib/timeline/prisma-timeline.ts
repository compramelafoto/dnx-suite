import { Prisma, prisma } from "@/lib/admin/db";
import type { EditionClock } from "./clock";
import { DEFAULT_EDITION_TIMEZONE, systemClock } from "./clock";
import { buildEditionTemporalState, shiftFutureEvents } from "./engine";
import { reprogramNotificationsAfterShift } from "./notifications";
import { toPromptPublicDto } from "./prompt-dto";
import { isReleasablePrompt, resolvePromptGate, type PromptGate } from "./prompt-gate";
import type { PromptRecord, TimelineEventView } from "./types";

const BASE_EVENTS: Array<{
  eventType: TimelineEventView["eventType"];
  name: string;
  sequence: number;
  isCritical: boolean;
}> = [
  { eventType: "REGISTRATION_OPEN", name: "Apertura de inscripciones", sequence: 10, isCritical: true },
  { eventType: "REGISTRATION_CLOSE", name: "Cierre de inscripciones", sequence: 20, isCritical: true },
  { eventType: "ACCREDITATION_OPEN", name: "Apertura de acreditación", sequence: 30, isCritical: true },
  { eventType: "ACCREDITATION_CLOSE", name: "Cierre de acreditación", sequence: 35, isCritical: true },
  { eventType: "MARATHON_START", name: "Inicio oficial", sequence: 40, isCritical: true },
  { eventType: "PROMPT_RELEASE", name: "Liberación de consignas", sequence: 50, isCritical: true },
  { eventType: "CAPTURE_WINDOW_CLOSE", name: "Cierre de captura", sequence: 60, isCritical: false },
  { eventType: "UPLOAD_WINDOW_OPEN", name: "Apertura de subida", sequence: 70, isCritical: false },
  { eventType: "UPLOAD_WINDOW_CLOSE", name: "Cierre de subida", sequence: 80, isCritical: true },
  { eventType: "MARATHON_END", name: "Fin de la maratón", sequence: 90, isCritical: true },
  { eventType: "JUDGING_OPEN", name: "Apertura de jurado", sequence: 95, isCritical: true },
  { eventType: "JUDGING_CLOSE", name: "Cierre de jurado", sequence: 98, isCritical: true },
  { eventType: "RESULTS_RELEASE", name: "Resultados", sequence: 100, isCritical: false },
];

function mapEvent(e: {
  id: string;
  eventType: string;
  name: string;
  startsAt: Date | null;
  endsAt: Date | null;
  status: string;
  sequence: number;
  isCritical: boolean;
  visibilityPolicy: string;
  triggerMode: string;
  manuallyReleasedAt: Date | null;
}): TimelineEventView {
  return {
    id: e.id,
    eventType: e.eventType as TimelineEventView["eventType"],
    name: e.name,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    status: e.status,
    sequence: e.sequence,
    isCritical: e.isCritical,
    visibilityPolicy: e.visibilityPolicy,
    triggerMode: e.triggerMode,
    manuallyReleasedAt: e.manuallyReleasedAt,
  };
}

export async function ensureDraftTimeline(editionId: string, actorUserId?: number) {
  const edition = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: editionId },
    select: { timezone: true },
  });
  const existing = await prisma.clickatonEditionTimeline.findFirst({
    where: { editionId, status: "DRAFT" },
    include: { events: true },
  });
  if (existing) return existing;

  const last = await prisma.clickatonEditionTimeline.findFirst({
    where: { editionId },
    orderBy: { version: "desc" },
  });
  const version = (last?.version ?? 0) + 1;
  return prisma.clickatonEditionTimeline.create({
    data: {
      editionId,
      version,
      status: "DRAFT",
      timezone: edition.timezone ?? DEFAULT_EDITION_TIMEZONE,
      createdByUserId: actorUserId ?? null,
      events: {
        create: BASE_EVENTS.map((e) => ({
          eventType: e.eventType,
          name: e.name,
          sequence: e.sequence,
          isCritical: e.isCritical,
          startsAt: null,
          endsAt: null,
          visibilityPolicy: "PUBLIC_SAFE",
          triggerMode: "SCHEDULED",
        })),
      },
    },
    include: { events: true },
  });
}

export async function activateTimeline(timelineId: string, actorUserId: number) {
  const timeline = await prisma.clickatonEditionTimeline.findUniqueOrThrow({
    where: { id: timelineId },
  });
  if (timeline.status !== "DRAFT") throw new Error("ONLY_DRAFT_ACTIVATABLE");

  await prisma.$transaction([
    prisma.clickatonEditionTimeline.updateMany({
      where: { editionId: timeline.editionId, status: "ACTIVE" },
      data: { status: "SUPERSEDED", supersededAt: new Date() },
    }),
    prisma.clickatonEditionTimeline.update({
      where: { id: timelineId },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
        activatedByUserId: actorUserId,
      },
    }),
    prisma.clickatonTimelineAudit.create({
      data: {
        timelineId,
        actorUserId,
        action: "ACTIVATE",
        payload: { version: timeline.version },
      },
    }),
  ]);
}

export async function getActiveTimeline(editionId: string) {
  return prisma.clickatonEditionTimeline.findFirst({
    where: { editionId, status: "ACTIVE" },
    include: { events: { orderBy: { sequence: "asc" } } },
  });
}

export async function getEditionTemporalState(editionId: string, clock: EditionClock = systemClock()) {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { timezone: true },
  });
  const active = await getActiveTimeline(editionId);
  const events = (active?.events ?? []).map(mapEvent);
  return buildEditionTemporalState({
    timezone: active?.timezone ?? edition?.timezone ?? DEFAULT_EDITION_TIMEZONE,
    timelineVersion: active?.version ?? null,
    timelineStatus: active?.status ?? null,
    paused: Boolean(active?.pausedAt),
    events,
    clock,
  });
}

/**
 * Portón único de apertura de consignas de la edición.
 *
 * Todas las consignas se habilitan en el mismo instante: no hay apertura
 * progresiva. Ver `lib/timeline/prompt-gate.ts`.
 */
export async function getEditionPromptGate(
  editionId: string,
  options?: { clock?: EditionClock; prompts?: Array<{ status: string; releasedAt: Date | null; captureStartsAt: Date | null }> },
): Promise<PromptGate> {
  const clock = options?.clock ?? systemClock();
  const [edition, active, prompts] = await Promise.all([
    prisma.clickatonEdition.findUnique({
      where: { id: editionId },
      select: { startAt: true },
    }),
    getActiveTimeline(editionId),
    options?.prompts
      ? Promise.resolve(options.prompts)
      : prisma.clickatonPrompt.findMany({
          where: { editionId },
          select: { status: true, releasedAt: true, captureStartsAt: true },
        }),
  ]);

  return resolvePromptGate({
    prompts,
    events: (active?.events ?? []).map(mapEvent),
    editionStartAt: edition?.startAt ?? null,
    clock,
  });
}

/**
 * Deja la base coherente con el portón: si ya abrió, todas las consignas
 * quedan RELEASED con el MISMO `releasedAt`. Idempotente.
 *
 * Importante para la carga de fotos: las ventanas efectivas se calculan con
 * `releasedAt`, así que la base no puede quedar atrás de lo que ve la persona.
 */
export async function releaseAllPromptsForEdition(input: {
  editionId: string;
  releasedAt: Date;
  actorUserId?: number | null;
}): Promise<number> {
  const alcance = {
    editionId: input.editionId,
    status: { in: ["READY", "LOCKED"] },
    releasedAt: null,
  } satisfies Prisma.ClickatonPromptWhereInput;
  const cambios = {
    status: "RELEASED",
    releasedAt: input.releasedAt,
    releasedByUserId: input.actorUserId ?? null,
  } satisfies Prisma.ClickatonPromptUncheckedUpdateManyInput;

  // La captura no puede empezar después de que la consigna sea visible: si la
  // planificación quedó más tarde (o vacía), se adelanta al instante de apertura.
  const [adelantadas, respetadas] = await prisma.$transaction([
    prisma.clickatonPrompt.updateMany({
      where: {
        ...alcance,
        OR: [{ captureStartsAt: null }, { captureStartsAt: { gt: input.releasedAt } }],
      },
      data: { ...cambios, captureStartsAt: input.releasedAt },
    }),
    prisma.clickatonPrompt.updateMany({
      where: { ...alcance, captureStartsAt: { lte: input.releasedAt } },
      data: cambios,
    }),
  ]);
  return adelantadas.count + respetadas.count;
}

async function syncPromptsWithGate(editionId: string, gate: PromptGate): Promise<void> {
  if (!gate.isOpen || !gate.opensAt) return;
  await releaseAllPromptsForEdition({ editionId, releasedAt: gate.opensAt });
}

export async function listPromptPublicDtos(
  editionId: string,
  options?: { clock?: EditionClock; participantPaid?: boolean },
) {
  const clock = options?.clock ?? systemClock();
  const rows = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    orderBy: { sequence: "asc" },
  });
  const releasable = rows.filter(isReleasablePrompt);
  const gate = await getEditionPromptGate(editionId, { clock, prompts: rows });

  if (!options?.participantPaid) {
    // Visitante: solo conteo LOCKED sin secretos, con la hora pública de apertura.
    return releasable.map((_, i) =>
      toPromptPublicDto(
        {
          id: `locked-${i}`,
          editionId,
          sequence: i + 1,
          internalName: `prompt-${i + 1}`,
          title: null,
          instructions: null,
          shortDescription: null,
          imageAssetId: null,
          videoAssetId: null,
          audioAssetId: null,
          captureStartsAt: gate.opensAt,
          captureEndsAt: null,
          uploadEndsAt: null,
          releaseMode: "SCHEDULED",
          status: "LOCKED",
          releasedAt: null,
          contentVersion: 1,
        },
        { clock, gate: { ...gate, isOpen: false } },
      ),
    );
  }

  await syncPromptsWithGate(editionId, gate);

  return releasable.map((r) =>
    toPromptPublicDto(r as PromptRecord, { clock, showOpensAt: true, gate }),
  );
}

/**
 * Crea nueva versión DRAFT desplazando solo eventos futuros.
 * No modifica timeline ACTIVE in-place.
 */
export async function shiftFutureEventsAsNewVersion(input: {
  editionId: string;
  minutes: number;
  actorUserId: number;
  fromEventId?: string;
  reason: string;
  clock?: EditionClock;
}) {
  const clock = input.clock ?? systemClock();
  const active = await getActiveTimeline(input.editionId);
  if (!active) throw new Error("NO_ACTIVE_TIMELINE");

  const preview = shiftFutureEvents(
    active.events.map(mapEvent),
    input.minutes,
    clock,
    input.fromEventId,
  );

  const draft = await prisma.clickatonEditionTimeline.create({
    data: {
      editionId: input.editionId,
      version: active.version + 1,
      status: "DRAFT",
      timezone: active.timezone,
      createdByUserId: input.actorUserId,
      events: {
        create: active.events.map((ev) => {
          const shifted = preview.find((p) => p.id === ev.id)!;
          return {
            eventType: ev.eventType,
            name: ev.name,
            description: ev.description,
            startsAt: shifted.startsAt,
            endsAt: shifted.endsAt,
            triggerMode: ev.triggerMode,
            visibilityPolicy: ev.visibilityPolicy,
            status: ev.status,
            sequence: ev.sequence,
            isCritical: ev.isCritical,
            metadata: {
              ...(typeof ev.metadata === "object" && ev.metadata ? ev.metadata : {}),
              shiftedFromEventId: ev.id,
              shiftMinutes: input.minutes,
              reason: input.reason,
            },
          };
        }),
      },
      audits: {
        create: {
          actorUserId: input.actorUserId,
          action: "SHIFT_FUTURE_DRAFT",
          payload: {
            minutes: input.minutes,
            reason: input.reason,
            fromEventId: input.fromEventId ?? null,
            changed: preview.filter((p) => p.changed).map((p) => p.id),
          },
        },
      },
    },
    include: { events: true },
  });

  await reprogramNotificationsAfterShift({
    sourceTimelineId: active.id,
    draftTimelineId: draft.id,
    actorUserId: input.actorUserId,
    minutes: input.minutes,
    reason: input.reason,
  });

  return { draft, preview };
}

export async function pauseTimeline(timelineId: string, actorUserId: number, reason: string) {
  await prisma.$transaction([
    prisma.clickatonEditionTimeline.update({
      where: { id: timelineId },
      data: { pausedAt: new Date(), pauseReason: reason.slice(0, 200) },
    }),
    prisma.clickatonTimelineAudit.create({
      data: {
        timelineId,
        actorUserId,
        action: "PAUSE",
        payload: { reason },
      },
    }),
  ]);
}
