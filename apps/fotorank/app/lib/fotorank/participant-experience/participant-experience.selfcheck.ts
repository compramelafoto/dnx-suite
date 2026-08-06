import assert from "node:assert/strict";
import { buildParticipantParticipationView } from "./build-view";
import { formatParticipantDate } from "./dates";
import { resolveParticipantNextAction } from "./next-action";
import { resolveNextStepBlock } from "./next-step-copy";
import { resolveParticipantProgress } from "./progress";
import {
  presentEntryStatus,
  presentPrimaryParticipationStatus,
  presentRegistrationStatus,
} from "./status-labels";
import { resolveUploadWindow } from "./upload-window";

const future = new Date("2030-01-15T12:00:00.000Z");
const past = new Date("2020-01-15T12:00:00.000Z");
const now = new Date("2026-08-06T12:00:00.000Z");

/* Estados — sin enums crudos al participante */
assert.equal(presentRegistrationStatus("CONFIRMED").label, "Confirmada");
assert.equal(presentRegistrationStatus("CANCELLED").label, "Cancelada");
assert.equal(presentRegistrationStatus("PENDING_PAYMENT").label, "Pago pendiente");
assert.ok(!presentRegistrationStatus("CONFIRMED").label.includes("CONFIRMED"));
assert.equal(presentEntryStatus(null).label, "Sin fotografía");
assert.equal(presentEntryStatus("CONFIRMED").label, "Enviada");
assert.equal(
  presentPrimaryParticipationStatus({
    registrationStatus: "CONFIRMED",
    manualReviewStatus: "REPLACEMENT_REQUESTED",
  }).label,
  "Requiere corrección",
);
assert.ok(presentRegistrationStatus("UNKNOWN_X").label.length > 0);
assert.ok(!presentRegistrationStatus("UNKNOWN_X").label.includes("UNKNOWN_X"));

/* Ventana de carga */
const closed = resolveUploadWindow(
  {
    submissionOpensAt: future,
    submissionDeadline: null,
    registrationOpensAt: past,
    registrationClosesAt: null,
    startAt: past,
    status: "PUBLISHED",
  },
  now,
);
assert.equal(closed.isOpen, false);
assert.equal(closed.phase, "not_yet_open");

const open = resolveUploadWindow(
  {
    submissionOpensAt: past,
    submissionDeadline: future,
    registrationOpensAt: past,
    registrationClosesAt: null,
    startAt: past,
    status: "ACTIVE",
  },
  now,
);
assert.equal(open.isOpen, true);

/* Próxima acción */
const detailAction = resolveParticipantNextAction({
  registrationId: "reg-1",
  contestSlug: "santa-fe-en-foco",
  registrationStatus: "CONFIRMED",
  upload: closed,
});
assert.equal(detailAction.key, "view_detail");
assert.equal(detailAction.href, "/participaciones/reg-1");
assert.ok(!detailAction.label.toLowerCase().includes("cargar"));

const uploadAction = resolveParticipantNextAction({
  registrationId: "reg-1",
  contestSlug: "santa-fe-en-foco",
  registrationStatus: "CONFIRMED",
  upload: open,
});
assert.equal(uploadAction.key, "upload_photos");
assert.ok(uploadAction.enabled);

const incomplete = resolveParticipantNextAction({
  registrationId: "reg-2",
  contestSlug: "x",
  registrationStatus: "PENDING_PAYMENT",
  upload: closed,
});
assert.equal(incomplete.key, "complete_registration");

const correction = resolveParticipantNextAction({
  registrationId: "reg-3",
  contestSlug: "x",
  registrationStatus: "CONFIRMED",
  manualReviewStatus: "REPLACEMENT_REQUESTED",
  upload: open,
});
assert.equal(correction.key, "correct_photo");

/* Progreso */
const progressClosed = resolveParticipantProgress({
  registrationStatus: "CONFIRMED",
  upload: closed,
  hasJudgingWindow: true,
});
assert.ok(progressClosed.some((s) => s.key === "registration" && s.state === "completed"));
assert.ok(progressClosed.some((s) => s.key === "upload" && s.state === "locked"));

/* Next step copy */
const step = resolveNextStepBlock({
  registrationStatus: "CONFIRMED",
  categoryName: "Fotógrafo Amateur",
  maxFiles: 1,
  upload: closed,
});
assert.match(step.title, /confirmada/i);
assert.match(step.message, /no está habilitada|no tenés que hacer/i);
assert.ok(!step.message.toLowerCase().includes("avisaremos"));

/* Vista integrada */
const view = buildParticipantParticipationView({
  id: "reg-1",
  contestId: "c1",
  contestTitle: "Santa Fe en Foco",
  contestSlug: "santa-fe-en-foco",
  registrationNumber: "SANTAF-VISUAL-01",
  categoryId: "cat-1",
  categoryName: "Fotógrafo Amateur",
  categorySlug: "fotografo-amateur",
  maxFiles: 1,
  registrationStatus: "CONFIRMED",
  paymentStatus: "NOT_REQUIRED",
  registeredAt: past,
  confirmedAt: past,
  entry: null,
  contest: {
    submissionOpensAt: future,
    submissionDeadline: null,
    registrationOpensAt: past,
    registrationClosesAt: null,
    startAt: past,
    status: "PUBLISHED",
    timezone: "America/Argentina/Buenos_Aires",
    judgingStartAt: null,
    judgingEndAt: null,
    resultsAt: null,
  },
  now,
});
assert.equal(view.nextAction.key, "view_detail");
assert.equal(view.primaryStatus.label, "Confirmada");
assert.equal(view.uploadedCount, 0);
assert.ok(view.categoryPresentation.kind === "amateur");
assert.ok(!JSON.stringify(view.nextStep).includes("CONFIRMED"));

const cancelled = buildParticipantParticipationView({
  ...{
    id: "reg-x",
    contestId: "c1",
    contestTitle: "X",
    contestSlug: "x",
    registrationNumber: "X-1",
    categoryId: "c",
    categoryName: "Cat",
    categorySlug: "cat",
    maxFiles: 1,
    registrationStatus: "CANCELLED",
    paymentStatus: "NOT_REQUIRED",
    registeredAt: null,
    confirmedAt: null,
    entry: null,
    contest: {
      submissionOpensAt: past,
      submissionDeadline: future,
      registrationOpensAt: past,
      registrationClosesAt: null,
      startAt: past,
      status: "PUBLISHED",
      timezone: null,
      judgingStartAt: null,
      judgingEndAt: null,
      resultsAt: null,
    },
    now,
  },
});
assert.equal(cancelled.primaryStatus.label, "Cancelada");

const withEntry = buildParticipantParticipationView({
  id: "reg-e",
  contestId: "c1",
  contestTitle: "X",
  contestSlug: "x",
  registrationNumber: "X-2",
  categoryId: "c",
  categoryName: "Cat",
  categorySlug: "cat",
  maxFiles: 2,
  registrationStatus: "CONFIRMED",
  paymentStatus: "NOT_REQUIRED",
  registeredAt: past,
  confirmedAt: past,
  entry: {
    id: "e1",
    status: "CONFIRMED",
    entryNumber: "E-1",
    technicalSummaryStatus: "APPROVED",
    manualReviewStatus: "NONE",
    admissionStatus: "ADMITTED",
    publicRejectionReason: null,
  },
  contest: {
    submissionOpensAt: past,
    submissionDeadline: future,
    registrationOpensAt: past,
    registrationClosesAt: null,
    startAt: past,
    status: "PUBLISHED",
    timezone: null,
    judgingStartAt: past,
    judgingEndAt: future,
    resultsAt: future,
  },
  now,
});
assert.equal(withEntry.primaryStatus.label, "Admitida");
assert.equal(withEntry.uploadedCount, 1);

assert.ok(formatParticipantDate(future)?.includes("2030"));

console.log("participant-experience.selfcheck: OK");
