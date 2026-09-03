import type { EditionClock } from "./clock";
import { systemClock } from "./clock";
import type { TimelineEventView } from "./types";

/**
 * Apertura conjunta de consignas ("todas juntas, nunca progresiva").
 *
 * Regla de producto: las consignas de una edición se habilitan en un único
 * instante. Antes de ese instante el participante ve una cuenta regresiva y
 * cero contenido; al llegar a cero ve TODAS las consignas a la vez.
 *
 * Este módulo es puro (sin Prisma) para poder testearlo con reloj fijo.
 */

export type PromptGateSource =
  | "MANUAL_RELEASE"
  | "TIMELINE_PROMPT_RELEASE"
  | "TIMELINE_MARATHON_START"
  | "PROMPT_SCHEDULE"
  | "EDITION_START"
  | "NONE";

export type PromptGate = {
  /** Instante único de apertura. `null` = sin fecha cargada todavía. */
  opensAt: Date | null;
  /** `true` cuando el instante ya pasó (o hubo apertura manual). */
  isOpen: boolean;
  source: PromptGateSource;
};

export type PromptGateInput = {
  status: string;
  releasedAt: Date | null;
  captureStartsAt: Date | null;
};

/** Consignas que forman parte del evento (las DRAFT/CANCELLED no cuentan). */
export function isReleasablePrompt(prompt: { status: string }): boolean {
  return prompt.status !== "DRAFT" && prompt.status !== "CANCELLED";
}

function earliest(dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  if (valid.length === 0) return null;
  return valid.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
}

function eventStart(
  events: TimelineEventView[] | undefined,
  eventType: TimelineEventView["eventType"],
): Date | null {
  const event = events?.find((e) => e.eventType === eventType && e.status !== "CANCELLED");
  if (!event) return null;
  return event.manuallyReleasedAt ?? event.startsAt ?? null;
}

/**
 * Resuelve el único portón de apertura de la edición.
 *
 * Prioridad:
 * 1. Apertura ya ejecutada (alguna consigna con `releasedAt`) → esa marca manda.
 * 2. Evento PROMPT_RELEASE del cronograma.
 * 3. Evento MARATHON_START.
 * 4. La primera `captureStartsAt` planificada entre las consignas.
 * 5. `startAt` de la edición.
 */
export function resolvePromptGate(input: {
  prompts: PromptGateInput[];
  events?: TimelineEventView[];
  editionStartAt?: Date | null;
  clock?: EditionClock;
}): PromptGate {
  const clock = input.clock ?? systemClock();
  const now = clock.now().getTime();
  const prompts = input.prompts.filter(isReleasablePrompt);

  const releasedAt = earliest(prompts.map((p) => p.releasedAt));
  if (releasedAt) {
    return {
      opensAt: releasedAt,
      isOpen: releasedAt.getTime() <= now,
      source: "MANUAL_RELEASE",
    };
  }

  // status RELEASED sin timestamp: apertura vigente sin fecha registrada.
  if (prompts.some((p) => p.status === "RELEASED")) {
    return { opensAt: null, isOpen: true, source: "MANUAL_RELEASE" };
  }

  const candidates: Array<[Date | null, PromptGateSource]> = [
    [eventStart(input.events, "PROMPT_RELEASE"), "TIMELINE_PROMPT_RELEASE"],
    [eventStart(input.events, "MARATHON_START"), "TIMELINE_MARATHON_START"],
    [earliest(prompts.map((p) => p.captureStartsAt)), "PROMPT_SCHEDULE"],
    [input.editionStartAt ?? null, "EDITION_START"],
  ];

  for (const [date, source] of candidates) {
    if (!date) continue;
    return { opensAt: date, isOpen: date.getTime() <= now, source };
  }

  return { opensAt: null, isOpen: false, source: "NONE" };
}

/** Milisegundos restantes para la apertura (0 si ya abrió o no hay fecha). */
export function millisecondsUntilGateOpens(
  gate: PromptGate,
  clock: EditionClock = systemClock(),
): number {
  if (gate.isOpen || !gate.opensAt) return 0;
  return Math.max(0, gate.opensAt.getTime() - clock.now().getTime());
}
