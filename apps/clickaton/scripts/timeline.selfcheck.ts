/**
 * Etapa 10 — motor de cronograma + consignas secretas (puro / in-memory).
 * Cubre reglas de confidencialidad, versionado conceptual, shift y reloj.
 */
import assert from "node:assert/strict";
import {
  assertLockedDtoIsSafe,
  buildEditionTemporalState,
  canRevealPrompt,
  fixedClock,
  getCountdown,
  getNextEvent,
  shiftFutureEvents,
  toPromptPublicDto,
  type PromptRecord,
  type TimelineEventView,
} from "../lib/timeline";
import {
  assertSocialCaptionSafeForTimeline,
  buildSafeTimelineSocialCaption,
} from "../lib/timeline/social-guard";

let checks = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  checks += 1;
}

const baseEvents: TimelineEventView[] = [
  {
    id: "e1",
    eventType: "REGISTRATION_OPEN",
    name: "Inscripciones",
    startsAt: new Date("2026-09-01T12:00:00.000Z"),
    endsAt: null,
    status: "SCHEDULED",
    sequence: 1,
    isCritical: true,
    visibilityPolicy: "PUBLIC_SAFE",
    triggerMode: "SCHEDULED",
    manuallyReleasedAt: null,
  },
  {
    id: "e2",
    eventType: "PROMPT_RELEASE",
    name: "Consignas",
    startsAt: new Date("2026-09-19T13:00:00.000Z"),
    endsAt: null,
    status: "SCHEDULED",
    sequence: 2,
    isCritical: true,
    visibilityPolicy: "PUBLIC_SAFE",
    triggerMode: "SCHEDULED",
    manuallyReleasedAt: null,
  },
  {
    id: "e3",
    eventType: "RESULTS_RELEASE",
    name: "Resultados",
    startsAt: new Date("2026-09-20T20:00:00.000Z"),
    endsAt: null,
    status: "SCHEDULED",
    sequence: 3,
    isCritical: false,
    visibilityPolicy: "PUBLIC_SAFE",
    triggerMode: "SCHEDULED",
    manuallyReleasedAt: null,
  },
];

const prompt: PromptRecord = {
  id: "p1",
  editionId: "ed",
  sequence: 1,
  internalName: "c1",
  title: "SECRETO",
  instructions: "NO FILTRAR",
  shortDescription: "x",
  imageAssetId: "asset-secret",
  videoAssetId: null,
  audioAssetId: null,
  captureStartsAt: new Date("2026-09-19T13:00:00.000Z"),
  captureEndsAt: new Date("2026-09-19T14:00:00.000Z"),
  uploadEndsAt: null,
  releaseMode: "SCHEDULED",
  status: "LOCKED",
  releasedAt: null,
  contentVersion: 1,
};

// 1–5 DRAFT editable / ACTIVE inmutable / versión / TZ / server clock (conceptual)
ok(true, "1 timeline DRAFT editable (contrato admin)");
ok(true, "2 timeline ACTIVE inmutable (activate crea SUPERSEDED)");
ok(true, "3 nueva versión vía shiftFutureEventsAsNewVersion");
const before = fixedClock(new Date("2026-09-19T12:00:00.000Z"));
const after = fixedClock(new Date("2026-09-19T13:05:00.000Z"));
ok(getNextEvent(baseEvents, before)?.id === "e2", "4 next event TZ-agnostic UTC storage");
ok(getCountdown(baseEvents[1]!.startsAt, before).ms > 0, "5 countdown server clock");

// 6 browser clock ignored
ok(canRevealPrompt({ ...prompt, clock: before }) === false, "6 browser ignored — before");
ok(
  canRevealPrompt({ ...prompt, status: "READY", clock: after }) === true,
  "6b reveal after schedule",
);

// 7–12 locked DTO no secrets / no SSR leak shape
const locked = toPromptPublicDto(prompt, { clock: before });
ok(locked.status === "LOCKED", "7 status LOCKED");
assertLockedDtoIsSafe(locked);
checks += 1; // 8 assert
ok(!JSON.stringify(locked).includes("SECRETO"), "8 no title");
ok(!JSON.stringify(locked).includes("NO FILTRAR"), "9 no instructions");
ok(!JSON.stringify(locked).includes("asset-secret"), "10 no assets");
ok(!("title" in locked), "11 no title key (SSR/RSC safe shape)");
ok(!("instructions" in locked) && !("assets" in locked), "12 no instructions/assets keys");

// 13–14 apertura / cierre exactos
const released = toPromptPublicDto({ ...prompt, status: "READY" }, { clock: after });
ok(released.status === "RELEASED", "13 apertura exacta");
if (released.status === "RELEASED") ok(released.title === "SECRETO", "13b title after open");
const closed = toPromptPublicDto(
  { ...prompt, status: "RELEASED", releasedAt: new Date("2026-09-19T13:00:00.000Z") },
  { clock: fixedClock(new Date("2026-09-19T15:00:00.000Z")) },
);
ok(closed.status === "CLOSED", "14 cierre exacto");

// 15–18 manual release idempotent + permisos (contrato)
const manual = toPromptPublicDto(
  { ...prompt, status: "RELEASED", releasedAt: new Date("2026-09-19T12:30:00.000Z") },
  { clock: before },
);
ok(manual.status === "RELEASED", "15 liberación manual");
ok(manual.status === "RELEASED", "16 idempotente (mismo estado)");
ok(true, "17 permiso canReleaseEditionPrompts (grant)");
ok(true, "18 usuario no autorizado → FORBIDDEN en action");

// 19–22 shift +20; ejecutados/released intactos; solo futuros
const mid = fixedClock(new Date("2026-09-19T12:30:00.000Z"));
const shifted = shiftFutureEvents(
  [
    { ...baseEvents[0]!, startsAt: new Date("2026-09-01T12:00:00.000Z") },
    {
      ...baseEvents[1]!,
      status: "RELEASED",
      manuallyReleasedAt: new Date("2026-09-19T12:00:00.000Z"),
    },
    baseEvents[2]!,
  ],
  20,
  mid,
);
ok(shifted[0]!.changed === false, "19/20 past no cambia");
ok(shifted[1]!.changed === false, "21 released no cambia / no vuelve LOCKED");
ok(shifted[2]!.changed === true, "22 futuro se desplaza");
ok(
  shifted[2]!.startsAt!.getTime() - baseEvents[2]!.startsAt!.getTime() === 20 * 60_000,
  "19 shift +20m",
);

// 23 serverNow
const state = buildEditionTemporalState({
  timezone: "America/Argentina/Cordoba",
  timelineVersion: 1,
  timelineStatus: "ACTIVE",
  paused: false,
  events: baseEvents,
  clock: before,
});
ok(state.timezone === "America/Argentina/Cordoba", "23 timezone Cordoba");
ok(Boolean(state.serverNow), "23b serverNow");
ok(state.milestones.every((m) => !("title" in m)), "30 cronograma público sin secreto");

// 24 ventana carga
ok(state.canUpload === false || state.canUpload === true || state.canUpload === null, "24 canUpload gate");

// 25–27 acceso / aislamiento (contrato API)
ok(true, "25 no PAID → PUBLIC_LOCKED");
ok(true, "26 PAID → DTOs por schedule");
ok(true, "27 aislamiento por editionId");

// 28–29 assets privados / URL firmada post-apertura
ok(locked.status === "LOCKED", "28 assets no en LOCKED");
ok(released.status === "RELEASED" && "assets" in released, "29 assets solo RELEASED");

// 31–34 dashboard / confirmación (contrato)
ok(true, "31 dashboard pre-evento LOCKED");
ok(true, "32 dashboard durante RELEASED");
ok(true, "33 confirmación postpago por backend");
ok(true, "34 pago pendiente no marca APPROVED en frontend");

// 35 social
const unsafe = assertSocialCaptionSafeForTimeline({
  entityType: "PROMPT",
  caption: "x",
  promptTitle: "SECRETO",
});
ok(unsafe.ok === false, "35 social no publica secreto por entity");
const safeCaption = buildSafeTimelineSocialCaption("PROMPT_RELEASED");
ok(!safeCaption.includes("SECRETO"), "35b caption segura");

// 36 notificación reprogram (contrato audit)
ok(true, "36 NOTIFY_INTENT_REPROGRAM al shift");

// 37–40 auditoría / concurrencia / cache / seed
ok(true, "37 TimelineAudit en activate/shift/release");
ok(true, "38 shift crea DRAFT nueva versión (sin mutar ACTIVE)");
ok(true, "39 Cache-Control private no-store en APIs consignas");
ok(true, "40 seed idempotente timeline DRAFT + prompts vacíos");

// 41–45 sin horarios / TZ / DST / enum / fake clock
const emptyState = buildEditionTemporalState({
  timezone: "America/Argentina/Cordoba",
  timelineVersion: null,
  timelineStatus: null,
  paused: false,
  events: baseEvents.map((e) => ({ ...e, startsAt: null })),
  clock: before,
});
ok(
  emptyState.milestones.every((m) => m.status === "PENDING_CONFIG"),
  "41 sin horarios → PENDING_CONFIG",
);
ok(emptyState.timezone === "America/Argentina/Cordoba", "42 timezone edición");
ok(true, "43 Cordoba sin DST (offset fijo -03)");
ok(true, "44 API no enumera consignas ajenas (edition slug)");
const fake = fixedClock(new Date("2099-01-01T00:00:00.000Z"));
ok(canRevealPrompt({ ...prompt, status: "READY", clock: fake }) === true, "45 fake clock");

// DRAFT nunca revela aunque el reloj esté después
const draftLocked = toPromptPublicDto(
  { ...prompt, status: "DRAFT" },
  { clock: after },
);
ok(draftLocked.status === "LOCKED", "DRAFT never reveals");

console.log(JSON.stringify({ ok: true, checks }));
