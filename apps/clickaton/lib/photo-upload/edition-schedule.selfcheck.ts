/**
 * Selfcheck ETAPA 12 — reveal global + ventanas independientes.
 *   pnpm --filter clickaton exec tsx lib/photo-upload/edition-schedule.selfcheck.ts
 */
import assert from "node:assert/strict";
import { fixedClock } from "@/lib/timeline/clock";
import { toPromptPublicDto, assertLockedDtoIsSafe } from "@/lib/timeline/prompt-dto";
import {
  arePromptsGloballyRevealed,
  getCapturePhase,
  getUploadPhase,
  resolveEditionSchedule,
} from "./edition-schedule";
import {
  evaluateCaptureDate,
  getUploadWindowState,
  resolveEffectiveWindows,
} from "./windows";

const edition = {
  globalPromptReveal: true,
  eventRevealAt: new Date("2026-09-19T16:00:00.000-03:00"),
  captureWindowStartsAt: new Date("2026-09-19T16:00:00.000-03:00"),
  captureWindowEndsAt: new Date("2026-09-19T20:00:00.000-03:00"),
  uploadWindowStartsAt: new Date("2026-09-19T16:00:00.000-03:00"),
  uploadWindowEndsAt: new Date("2026-09-19T22:00:00.000-03:00"),
  allowReplacement: true,
  captureClockToleranceMinutes: 5,
};

const prompt = {
  id: "p1",
  editionId: "e1",
  sequence: 1,
  internalName: "p1",
  title: "SECRETO",
  instructions: "NO LEAK",
  shortDescription: null,
  imageAssetId: null,
  videoAssetId: null,
  audioAssetId: null,
  captureStartsAt: new Date("2026-09-19T10:00:00.000-03:00"), // misleading staggered
  captureEndsAt: new Date("2026-09-19T11:00:00.000-03:00"),
  uploadStartsAt: new Date("2026-09-19T10:00:00.000-03:00"),
  uploadEndsAt: new Date("2026-09-19T11:00:00.000-03:00"),
  releaseMode: "SCHEDULED",
  status: "LOCKED",
  releasedAt: new Date("2026-09-19T16:00:00.000-03:00"),
  contentVersion: 1,
};

// 1) Before reveal — LOCKED, no leak
{
  const clock = fixedClock(new Date("2026-09-19T15:00:00.000-03:00"));
  const dto = toPromptPublicDto(prompt, { clock, editionSchedule: edition, showOpensAt: true });
  assert.equal(dto.status, "LOCKED");
  assertLockedDtoIsSafe(dto);
  assert.ok(!JSON.stringify(dto).includes("SECRETO"));
}

// 2) After reveal — all RELEASED with edition windows (not prompt staggered)
{
  const clock = fixedClock(new Date("2026-09-19T17:00:00.000-03:00"));
  assert.equal(arePromptsGloballyRevealed(resolveEditionSchedule(edition), clock), true);
  const dto = toPromptPublicDto(prompt, { clock, editionSchedule: edition });
  assert.equal(dto.status, "RELEASED");
  if (dto.status === "RELEASED") {
    assert.equal(dto.title, "SECRETO");
    assert.ok(dto.uploadEndsAt?.includes("2026-09-19T22:00:00") || dto.uploadEndsAt?.includes("01:00:00"));
  }
}

// 3) Capture/upload independence
{
  const schedule = resolveEditionSchedule(edition);
  const windows = resolveEffectiveWindows(prompt, edition);
  // Must NOT use releasedAt as capture start when edition windows exist
  assert.equal(windows.captureStartsAt?.toISOString(), edition.captureWindowStartsAt.toISOString());
  assert.notEqual(windows.captureStartsAt?.toISOString(), prompt.captureStartsAt.toISOString());

  const clockMid = fixedClock(new Date("2026-09-19T17:30:00.000-03:00"));
  assert.equal(getCapturePhase(schedule, clockMid), "OPEN");
  assert.equal(getUploadPhase(schedule, clockMid), "OPEN");

  const clockAfterCapture = fixedClock(new Date("2026-09-19T21:00:00.000-03:00"));
  assert.equal(getCapturePhase(schedule, clockAfterCapture), "CLOSED");
  assert.equal(getUploadPhase(schedule, clockAfterCapture), "OPEN");
  assert.equal(getUploadWindowState(windows, clockAfterCapture), "OPEN");

  const clockAfterUpload = fixedClock(new Date("2026-09-19T22:00:00.000-03:00"));
  assert.equal(getUploadWindowState(windows, clockAfterUpload), "CLOSED");
}

// 4) EXIF uses capture window (not upload)
{
  const windows = resolveEffectiveWindows(prompt, edition);
  const ok = evaluateCaptureDate({
    captureDate: new Date("2026-09-19T19:45:00.000-03:00"),
    windows,
    toleranceMinutes: 5,
    timezone: "America/Argentina/Buenos_Aires",
  });
  assert.equal(ok.result, "PASS");

  const lateCapture = evaluateCaptureDate({
    captureDate: new Date("2026-09-19T20:30:00.000-03:00"),
    windows,
    toleranceMinutes: 5,
    timezone: "America/Argentina/Buenos_Aires",
  });
  assert.ok(lateCapture.result === "MANUAL_REVIEW" || lateCapture.result === "FAIL");

  const noExif = evaluateCaptureDate({
    captureDate: null,
    windows,
    toleranceMinutes: 5,
    timezone: "America/Argentina/Buenos_Aires",
  });
  assert.equal(noExif.result, "MANUAL_REVIEW");
}

console.log("edition-schedule.selfcheck: PASS");
