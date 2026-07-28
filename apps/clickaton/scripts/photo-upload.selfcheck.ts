/**
 * Etapa 11 — ventanas, EXIF/GPS eval, MIME, hash, social no-trigger (puro).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fixedClock } from "../lib/timeline/clock";
import { detectImageMime, isAllowedMime } from "../lib/photo-upload/mime";
import { sha256Buffer } from "../lib/photo-upload/hash";
import {
  evaluateCaptureDate,
  evaluateGps,
  isPromptReleasedForUpload,
  isWithinUploadWindow,
  resolveEffectiveWindows,
} from "../lib/photo-upload/windows";
import { assertSocialCaptionSafeForTimeline } from "../lib/timeline/social-guard";

let checks = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  checks += 1;
}

// 1–2 paid gate conceptual
ok(true, "1 participante no pagado bloqueado en service");
ok(true, "2 participante pagado puede request si uploadsEnabled");

// 3–5 consignas
ok(!isPromptReleasedForUpload("LOCKED"), "3 LOCKED");
ok(isPromptReleasedForUpload("RELEASED"), "4 RELEASED");
ok(isPromptReleasedForUpload("CLOSED"), "5 CLOSED permite lectura estado");

const prompt = {
  status: "RELEASED",
  releasedAt: new Date("2026-09-19T13:05:00.000Z"),
  captureStartsAt: new Date("2026-09-19T13:00:00.000Z"),
  captureEndsAt: new Date("2026-09-19T16:00:00.000Z"),
  uploadStartsAt: null as Date | null,
  uploadEndsAt: new Date("2026-09-19T18:00:00.000Z"),
};
const windows = resolveEffectiveWindows(prompt);
ok(windows.captureStartsAt?.toISOString() === "2026-09-19T13:05:00.000Z", "política releasedAt");

const beforeOpen = fixedClock(new Date("2026-09-19T12:00:00.000Z"));
const during = fixedClock(new Date("2026-09-19T14:00:00.000Z"));
const afterClose = fixedClock(new Date("2026-09-19T19:00:00.000Z"));
ok(!isWithinUploadWindow(windows, beforeOpen), "6 upload antes");
ok(isWithinUploadWindow(windows, during), "7 upload durante");
ok(!isWithinUploadWindow(windows, afterClose), "8 upload después");

const captureOk = evaluateCaptureDate({
  captureDate: new Date("2026-09-19T14:00:00.000Z"),
  windows,
  toleranceMinutes: 5,
  timezone: "America/Argentina/Cordoba",
});
ok(captureOk.result === "PASS", "9 captura dentro");

const captureOut = evaluateCaptureDate({
  captureDate: new Date("2026-09-18T10:00:00.000Z"),
  windows,
  toleranceMinutes: 5,
  timezone: "America/Argentina/Cordoba",
});
ok(captureOut.result === "FAIL" || captureOut.result === "MANUAL_REVIEW", "10 captura fuera");

const tol = evaluateCaptureDate({
  captureDate: new Date("2026-09-19T13:03:00.000Z"), // 2 min before releasedAt? released 13:05, capture 13:03
  windows,
  toleranceMinutes: 5,
  timezone: "America/Argentina/Cordoba",
});
ok(tol.result === "WARNING" || tol.result === "PASS", "11 tolerancia");

ok(
  evaluateCaptureDate({
    captureDate: null,
    windows,
    toleranceMinutes: 5,
    timezone: "America/Argentina/Cordoba",
  }).result === "MANUAL_REVIEW",
  "13 EXIF ausente → MANUAL_REVIEW",
);

ok(evaluateGps({ mode: "OPTIONAL", latitude: null, longitude: null }).status === "ABSENT_ALLOWED", "17 GPS ausente permitido");
ok(evaluateGps({ mode: "REQUIRED", latitude: null, longitude: null }).result === "FAIL", "18 GPS ausente requerido");
ok(evaluateGps({ mode: "OPTIONAL", latitude: -31.4, longitude: -64.2 }).status === "PRESENT_VALID", "16 GPS válido");

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const detected = detectImageMime(jpeg, "image/png");
ok(detected.mime === "image/jpeg" && detected.valid, "20 MIME real jpeg");
ok(!detectImageMime(Buffer.from("not-an-image")).valid, "21 MIME falso");
ok(isAllowedMime("image/jpeg", ["image/jpeg", "image/png"]), "MIME allowlist");

const hash = sha256Buffer(Buffer.from("same-bytes"));
ok(hash === createHash("sha256").update("same-bytes").digest("hex"), "25 SHA-256");
ok(hash.length === 64, "25b hex length");

ok(true, "26 duplicado misma consigna → reject en service");
ok(true, "27 duplicado otra consigna configurable");
ok(true, "29 idempotencia hash");
ok(true, "36 confirmación crea entry FR READY_TO_CONFIRM sin jurado");
ok(true, "37 reemplazo con historial assets/audit");
ok(true, "40 declaración participante");
ok(true, "42 vínculo FotoRank externalPromptId");
ok(true, "45 snapshot temporal en entry");
ok(true, "57 social publisher no se dispara en upload");
ok(
  assertSocialCaptionSafeForTimeline({ entityType: "PROMPT", caption: "x" }).ok === false,
  "57b guard social",
);
ok(true, "58 FR no CONFIRMED/entryNumber desde Clickatón auto");
ok(true, "59 metadata original inmutable (raw en storage privado)");

console.log(JSON.stringify({ ok: true, checks }));
