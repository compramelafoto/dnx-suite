import type { EditionClock } from "./clock";
import { systemClock } from "./clock";
import type {
  EditionTemporalStateDto,
  PublicTimelineMilestoneDto,
  TimelineEventView,
} from "./types";

function milestoneStatus(
  ev: TimelineEventView,
  now: Date,
): PublicTimelineMilestoneDto["status"] {
  if (!ev.startsAt) return "PENDING_CONFIG";
  if (ev.status === "CANCELLED") return "CLOSED";
  if (ev.manuallyReleasedAt || ev.status === "RELEASED") return "RELEASED";
  const t = now.getTime();
  if (ev.endsAt && ev.endsAt.getTime() < t) return "CLOSED";
  if (ev.startsAt.getTime() <= t) return "OPEN";
  return "UPCOMING";
}

export function isEventOpen(ev: TimelineEventView, clock: EditionClock = systemClock()): boolean {
  return milestoneStatus(ev, clock.now()) === "OPEN" || milestoneStatus(ev, clock.now()) === "RELEASED";
}

export function isEventClosed(ev: TimelineEventView, clock: EditionClock = systemClock()): boolean {
  return milestoneStatus(ev, clock.now()) === "CLOSED";
}

export function getNextEvent(
  events: TimelineEventView[],
  clock: EditionClock = systemClock(),
): TimelineEventView | null {
  const now = clock.now().getTime();
  const upcoming = events
    .filter((e) => e.startsAt && e.startsAt.getTime() > now && e.status !== "CANCELLED")
    .sort((a, b) => (a.startsAt!.getTime() - b.startsAt!.getTime()));
  return upcoming[0] ?? null;
}

export function getCountdown(
  target: Date | null,
  clock: EditionClock = systemClock(),
): { ms: number; serverNow: string; target: string | null } {
  const now = clock.now();
  if (!target) return { ms: 0, serverNow: now.toISOString(), target: null };
  return {
    ms: Math.max(0, target.getTime() - now.getTime()),
    serverNow: now.toISOString(),
    target: target.toISOString(),
  };
}

export function canRevealPrompt(input: {
  status: string;
  captureStartsAt: Date | null;
  releasedAt: Date | null;
  clock?: EditionClock;
}): boolean {
  const clock = input.clock ?? systemClock();
  if (input.status === "RELEASED" || input.releasedAt) return true;
  if (input.status === "CANCELLED" || input.status === "DRAFT") return false;
  if (input.captureStartsAt && input.captureStartsAt.getTime() <= clock.now().getTime()) {
    return true;
  }
  return false;
}

export function canUpload(input: {
  uploadWindowOpen: TimelineEventView | null;
  uploadWindowClose: TimelineEventView | null;
  clock?: EditionClock;
}): boolean {
  const clock = input.clock ?? systemClock();
  if (!input.uploadWindowOpen?.startsAt) return false;
  if (!isEventOpen(input.uploadWindowOpen, clock) && milestoneStatus(input.uploadWindowOpen, clock.now()) !== "RELEASED") {
    // open if start passed
    if (input.uploadWindowOpen.startsAt.getTime() > clock.now().getTime()) return false;
  }
  if (input.uploadWindowClose?.startsAt && input.uploadWindowClose.startsAt.getTime() <= clock.now().getTime()) {
    return false;
  }
  return input.uploadWindowOpen.startsAt.getTime() <= clock.now().getTime();
}

export function canCheckIn(input: {
  accreditationOpen: TimelineEventView | null;
  accreditationClose: TimelineEventView | null;
  clock?: EditionClock;
}): boolean {
  const clock = input.clock ?? systemClock();
  const open = input.accreditationOpen;
  if (!open?.startsAt) return false;
  if (open.startsAt.getTime() > clock.now().getTime()) return false;
  const close = input.accreditationClose;
  if (close?.startsAt && close.startsAt.getTime() <= clock.now().getTime()) return false;
  return true;
}

export function buildPublicMilestones(
  events: TimelineEventView[],
  clock: EditionClock = systemClock(),
): PublicTimelineMilestoneDto[] {
  const now = clock.now();
  return events
    .filter((e) => e.visibilityPolicy === "PUBLIC_SAFE" || e.visibilityPolicy === "PARTICIPANT_ONLY")
    .filter((e) => e.eventType !== "CUSTOM" || e.visibilityPolicy === "PUBLIC_SAFE")
    .map((e) => ({
      eventType: e.eventType,
      name: e.name,
      startsAt: e.startsAt?.toISOString() ?? null,
      endsAt: e.endsAt?.toISOString() ?? null,
      status: milestoneStatus(e, now),
    }));
}

export function buildEditionTemporalState(input: {
  timezone: string;
  timelineVersion: number | null;
  timelineStatus: string | null;
  paused: boolean;
  events: TimelineEventView[];
  clock?: EditionClock;
}): EditionTemporalStateDto {
  const clock = input.clock ?? systemClock();
  const milestones = buildPublicMilestones(input.events, clock);
  const next = getNextEvent(input.events, clock);
  const byType = (t: string) => input.events.find((e) => e.eventType === t) ?? null;

  return {
    timezone: input.timezone,
    serverNow: clock.now().toISOString(),
    timelineVersion: input.timelineVersion,
    timelineStatus: input.timelineStatus,
    paused: input.paused,
    nextEvent: next
      ? {
          eventType: next.eventType,
          name: next.name,
          startsAt: next.startsAt?.toISOString() ?? null,
          endsAt: next.endsAt?.toISOString() ?? null,
          status: milestoneStatus(next, clock.now()),
        }
      : null,
    milestones,
    canRegister: (() => {
      const open = byType("REGISTRATION_OPEN");
      const close = byType("REGISTRATION_CLOSE");
      if (!open?.startsAt) return null;
      if (open.startsAt.getTime() > clock.now().getTime()) return false;
      if (close?.startsAt && close.startsAt.getTime() <= clock.now().getTime()) return false;
      return true;
    })(),
    canCheckIn: canCheckIn({
      accreditationOpen: byType("ACCREDITATION_OPEN"),
      accreditationClose: byType("ACCREDITATION_CLOSE"),
      clock,
    }),
    canUpload: canUpload({
      uploadWindowOpen: byType("UPLOAD_WINDOW_OPEN"),
      uploadWindowClose: byType("UPLOAD_WINDOW_CLOSE"),
      clock,
    }),
  };
}

/** Desplaza startsAt/endsAt de eventos futuros; no toca ejecutados ni RELEASED. */
export function shiftFutureEvents(
  events: TimelineEventView[],
  minutes: number,
  clock: EditionClock = systemClock(),
  fromEventId?: string,
): Array<{ id: string; startsAt: Date | null; endsAt: Date | null; changed: boolean }> {
  const now = clock.now().getTime();
  const delta = minutes * 60_000;
  let gatePassed = !fromEventId;
  return events.map((ev) => {
    if (fromEventId && ev.id === fromEventId) gatePassed = true;
    if (!gatePassed) return { id: ev.id, startsAt: ev.startsAt, endsAt: ev.endsAt, changed: false };
    if (ev.manuallyReleasedAt || ev.status === "RELEASED") {
      return { id: ev.id, startsAt: ev.startsAt, endsAt: ev.endsAt, changed: false };
    }
    if (ev.startsAt && ev.startsAt.getTime() <= now) {
      return { id: ev.id, startsAt: ev.startsAt, endsAt: ev.endsAt, changed: false };
    }
    if (!ev.startsAt) {
      return { id: ev.id, startsAt: null, endsAt: ev.endsAt, changed: false };
    }
    return {
      id: ev.id,
      startsAt: new Date(ev.startsAt.getTime() + delta),
      endsAt: ev.endsAt ? new Date(ev.endsAt.getTime() + delta) : null,
      changed: true,
    };
  });
}
