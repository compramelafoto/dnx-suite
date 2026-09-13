import assert from "node:assert/strict";
import test from "node:test";

import { fixedClock } from "./clock";
import { toPromptPublicDto } from "./prompt-dto";
import {
  isPromptOpenForSubmission,
  millisecondsUntilGateOpens,
  resolvePromptGate,
} from "./prompt-gate";
import type { PromptRecord, TimelineEventView } from "./types";

const ANTES = fixedClock(new Date("2026-09-19T18:00:00.000Z"));
const DESPUES = fixedClock(new Date("2026-09-19T19:30:00.000Z"));
const APERTURA = new Date("2026-09-19T19:00:00.000Z");
const MAS_TARDE = new Date("2026-09-19T21:00:00.000Z");

function evento(
  eventType: TimelineEventView["eventType"],
  startsAt: Date | null,
): TimelineEventView {
  return {
    id: eventType,
    eventType,
    name: eventType,
    startsAt,
    endsAt: null,
    status: "SCHEDULED",
    sequence: 1,
    isCritical: true,
    visibilityPolicy: "PUBLIC_SAFE",
    triggerMode: "SCHEDULED",
    manuallyReleasedAt: null,
  };
}

function consigna(over: Partial<PromptRecord> = {}): PromptRecord {
  return {
    id: "p1",
    editionId: "ed",
    sequence: 1,
    internalName: "c1",
    title: "SECRETO",
    instructions: "NO FILTRAR",
    shortDescription: null,
    imageAssetId: "asset-secret",
    videoAssetId: null,
    audioAssetId: null,
    captureStartsAt: APERTURA,
    captureEndsAt: null,
    uploadEndsAt: null,
    releaseMode: "SCHEDULED",
    status: "LOCKED",
    releasedAt: null,
    contentVersion: 1,
    ...over,
  };
}

test("el cronograma manda: PROMPT_RELEASE define la apertura", () => {
  const gate = resolvePromptGate({
    prompts: [{ status: "LOCKED", releasedAt: null, captureStartsAt: MAS_TARDE }],
    events: [evento("PROMPT_RELEASE", APERTURA), evento("MARATHON_START", MAS_TARDE)],
    clock: ANTES,
  });
  assert.equal(gate.source, "TIMELINE_PROMPT_RELEASE");
  assert.deepEqual(gate.opensAt, APERTURA);
  assert.equal(gate.isOpen, false);
});

test("sin PROMPT_RELEASE cae en el inicio de la maratón", () => {
  const gate = resolvePromptGate({
    prompts: [{ status: "LOCKED", releasedAt: null, captureStartsAt: MAS_TARDE }],
    events: [evento("PROMPT_RELEASE", null), evento("MARATHON_START", APERTURA)],
    clock: DESPUES,
  });
  assert.equal(gate.source, "TIMELINE_MARATHON_START");
  assert.equal(gate.isOpen, true);
});

test("sin cronograma usa la primera hora planificada entre las consignas", () => {
  const gate = resolvePromptGate({
    prompts: [
      { status: "LOCKED", releasedAt: null, captureStartsAt: MAS_TARDE },
      { status: "READY", releasedAt: null, captureStartsAt: APERTURA },
    ],
    clock: ANTES,
  });
  assert.equal(gate.source, "PROMPT_SCHEDULE");
  assert.deepEqual(gate.opensAt, APERTURA);
});

test("una apertura ya ejecutada manda sobre el cronograma", () => {
  const gate = resolvePromptGate({
    prompts: [{ status: "RELEASED", releasedAt: APERTURA, captureStartsAt: MAS_TARDE }],
    events: [evento("PROMPT_RELEASE", MAS_TARDE)],
    clock: DESPUES,
  });
  assert.equal(gate.source, "MANUAL_RELEASE");
  assert.equal(gate.isOpen, true);
});

test("las consignas en preparación o canceladas no fijan la apertura", () => {
  const gate = resolvePromptGate({
    prompts: [
      { status: "DRAFT", releasedAt: APERTURA, captureStartsAt: APERTURA },
      { status: "CANCELLED", releasedAt: APERTURA, captureStartsAt: APERTURA },
      { status: "LOCKED", releasedAt: null, captureStartsAt: MAS_TARDE },
    ],
    clock: DESPUES,
  });
  assert.equal(gate.source, "PROMPT_SCHEDULE");
  assert.deepEqual(gate.opensAt, MAS_TARDE);
  assert.equal(gate.isOpen, false);
});

test("sin ninguna fecha cargada el portón queda cerrado y sin cuenta regresiva", () => {
  const gate = resolvePromptGate({
    prompts: [{ status: "LOCKED", releasedAt: null, captureStartsAt: null }],
    clock: ANTES,
  });
  assert.deepEqual(gate, { opensAt: null, isOpen: false, source: "NONE" });
  assert.equal(millisecondsUntilGateOpens(gate, ANTES), 0);
});

test("cuenta regresiva medida contra el reloj del servidor", () => {
  const gate = resolvePromptGate({
    prompts: [{ status: "LOCKED", releasedAt: null, captureStartsAt: APERTURA }],
    clock: ANTES,
  });
  assert.equal(millisecondsUntilGateOpens(gate, ANTES), 60 * 60 * 1000);
});

test("con el portón cerrado ninguna consigna filtra contenido, ni la ya liberada", () => {
  const gate = { opensAt: MAS_TARDE, isOpen: false, source: "TIMELINE_PROMPT_RELEASE" as const };
  const dto = toPromptPublicDto(consigna({ status: "RELEASED", releasedAt: APERTURA }), {
    clock: DESPUES,
    gate,
  });

  assert.equal(dto.status, "LOCKED");
  const raw = JSON.stringify(dto);
  assert.equal(raw.includes("SECRETO"), false);
  assert.equal(raw.includes("NO FILTRAR"), false);
  assert.equal(raw.includes("asset-secret"), false);
  assert.equal("opensAt" in dto && dto.opensAt, MAS_TARDE.toISOString());
});

test("con el portón abierto se revela hasta la consigna que aún no tenía su hora", () => {
  const gate = { opensAt: APERTURA, isOpen: true, source: "TIMELINE_PROMPT_RELEASE" as const };
  const dto = toPromptPublicDto(consigna({ status: "LOCKED", captureStartsAt: MAS_TARDE }), {
    clock: DESPUES,
    gate,
  });

  assert.equal(dto.status, "RELEASED", "todas juntas: no espera su propia hora");
  assert.equal("title" in dto && dto.title, "SECRETO");
});

test("con el portón abierto una consigna en preparación sigue oculta", () => {
  const gate = { opensAt: APERTURA, isOpen: true, source: "TIMELINE_PROMPT_RELEASE" as const };
  const dto = toPromptPublicDto(consigna({ status: "DRAFT" }), { clock: DESPUES, gate });
  assert.equal(dto.status, "LOCKED");
});

test("sin portón se conserva el comportamiento por consigna", () => {
  const dto = toPromptPublicDto(consigna({ status: "READY" }), { clock: DESPUES });
  assert.equal(dto.status, "RELEASED");
});

// ---------------------------------------------------------------------------
// Apertura por horario para subir y admitir fotos.
//
// Que el cron haya corrido o no NO puede decidir si la foto de un competidor
// vale: la hora planificada manda, igual que en la pantalla.
// ---------------------------------------------------------------------------

test("una consigna lista cuya hora ya pasó admite fotos sin que el cron la haya marcado", () => {
  const gate = resolvePromptGate({
    prompts: [{ status: "READY", releasedAt: null, captureStartsAt: APERTURA }],
    clock: DESPUES,
  });

  assert.equal(isPromptOpenForSubmission({ status: "READY", gate }), true);
});

test("una consigna en borrador nunca admite fotos, aunque el portón esté abierto", () => {
  const gate = resolvePromptGate({
    prompts: [{ status: "READY", releasedAt: null, captureStartsAt: APERTURA }],
    clock: DESPUES,
  });

  assert.equal(gate.isOpen, true);
  assert.equal(isPromptOpenForSubmission({ status: "DRAFT", gate }), false);
});

test("antes de la hora de apertura no se admiten fotos", () => {
  const gate = resolvePromptGate({
    prompts: [{ status: "READY", releasedAt: null, captureStartsAt: APERTURA }],
    clock: ANTES,
  });

  assert.equal(isPromptOpenForSubmission({ status: "READY", gate }), false);
});

test("una consigna cancelada nunca admite fotos", () => {
  const gate = resolvePromptGate({
    prompts: [{ status: "READY", releasedAt: null, captureStartsAt: APERTURA }],
    clock: DESPUES,
  });

  assert.equal(isPromptOpenForSubmission({ status: "CANCELLED", gate }), false);
});

test("lo ya liberado por el cron sigue admitiendo fotos igual que antes", () => {
  const gate = resolvePromptGate({
    prompts: [{ status: "RELEASED", releasedAt: APERTURA, captureStartsAt: APERTURA }],
    clock: DESPUES,
  });

  assert.equal(isPromptOpenForSubmission({ status: "RELEASED", gate }), true);
  assert.equal(isPromptOpenForSubmission({ status: "CLOSED", gate }), true);
});
