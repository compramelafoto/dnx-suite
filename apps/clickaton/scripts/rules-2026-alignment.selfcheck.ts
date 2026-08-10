/**
 * 10F.0 — selfcheck alineación Bases Clickatón 2026 (puro, sin DB/cobros).
 * pnpm --filter clickaton selfcheck:rules-2026
 */
import assert from "node:assert/strict";
import {
  ARGENTINA_2026_RULES,
  ARGENTINA_2026_SCHEDULE,
  ARGENTINA_2026_TIMEZONE,
  argentina2026UploadCloseAt,
  argentina2026UploadOpenAt,
  CAMERA_CLOCK_WARNING_ES,
  CLICKATON_TERMS_VERSION,
  CLICKATON_TERMS_VERSION_V1,
} from "../config/editions/argentina-2026";
import { fixedClock } from "../lib/timeline/clock";
import {
  evaluateCaptureDate,
  getUploadWindowState,
  isCaptureClosedUploadOpen,
  isWithinCaptureWindowExact,
  isWithinUploadWindow,
  resolveEffectiveWindows,
} from "../lib/photo-upload/windows";
import {
  addBusinessDays,
  annualPassPriceMinor,
  assignRandomAvailableBundle,
  buildAiSuspectReviewFlag,
  classifyEditTechnique,
  commercialLicenseForFinalist,
  computePhotographerRoyalty,
  consumeAnnualPassOnPromptsAccess,
  countCaptureValidPrompts,
  evaluateMinorGate,
  evaluateReturningParticipantEarlyPrice,
  expireAfterSecondMiss,
  resolveCompetitiveEligibility,
  resolveWinnerByLikes,
  returningWindow,
  selectTopFinalistsByScore,
  shouldUnpublishForNewSales,
  transferUnusedIndividualRegistration,
  votingClosesAt,
  AI_OR_MANIPULATION_SUSPECTED,
} from "../lib/rules-2026";

let n = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  n += 1;
}

// A — timezone + Schedule V2
ok(ARGENTINA_2026_TIMEZONE === "America/Argentina/Buenos_Aires", "TZ Buenos_Aires");
ok(ARGENTINA_2026_SCHEDULE.marathonStartIso.includes("T16:00:00"), "start 16:00");
ok(ARGENTINA_2026_SCHEDULE.talkOpenIso.includes("T16:00:00"), "talk 16:00");
ok(ARGENTINA_2026_SCHEDULE.talkCloseIso.includes("T16:30:00"), "talk end 16:30");
ok(ARGENTINA_2026_SCHEDULE.captureOpenIso.includes("T16:00:00"), "capture open 16:00");
ok(ARGENTINA_2026_SCHEDULE.captureCloseIso.includes("T20:00:00"), "capture end exclusive 20:00");
ok(ARGENTINA_2026_SCHEDULE.uploadOpenIso.includes("T16:00:00"), "upload open 16:00");
ok(ARGENTINA_2026_SCHEDULE.uploadCloseIso.includes("T22:00:00"), "upload close exclusive 22:00");
ok(CAMERA_CLOCK_WARNING_ES.includes("16:00") && CAMERA_CLOCK_WARNING_ES.includes("20:00"), "camera warning V2");
ok(CLICKATON_TERMS_VERSION === "CLICKATON_TERMS_2026_09_19_v2", "terms v2");
ok(CLICKATON_TERMS_VERSION_V1 === "CLICKATON_TERMS_2026_09_19_v1", "terms v1 retained");

const windows = resolveEffectiveWindows({
  status: "RELEASED",
  releasedAt: argentina2026UploadOpenAt(),
  captureStartsAt: new Date(ARGENTINA_2026_SCHEDULE.captureOpenIso),
  captureEndsAt: new Date(ARGENTINA_2026_SCHEDULE.captureCloseIso),
  uploadStartsAt: argentina2026UploadOpenAt(),
  uploadEndsAt: argentina2026UploadCloseAt(),
});

// T — capture exact boundaries (exclusive end, no invent timestamps)
ok(
  !isWithinCaptureWindowExact({
    captureDate: new Date("2026-09-19T15:59:59.000-03:00"),
    windows,
  }),
  "capture 15:59:59 INVALID",
);
ok(
  isWithinCaptureWindowExact({
    captureDate: new Date("2026-09-19T16:00:00.000-03:00"),
    windows,
  }),
  "capture 16:00:00 VALID",
);
ok(
  isWithinCaptureWindowExact({
    captureDate: new Date("2026-09-19T16:00:01.000-03:00"),
    windows,
  }),
  "capture 16:00:01 VALID",
);
ok(
  isWithinCaptureWindowExact({
    captureDate: new Date("2026-09-19T19:59:59.000-03:00"),
    windows,
  }),
  "capture 19:59:59 VALID",
);
ok(
  !isWithinCaptureWindowExact({
    captureDate: new Date("2026-09-19T20:00:00.000-03:00"),
    windows,
  }),
  "capture 20:00:00 INVALID",
);
ok(
  !isWithinCaptureWindowExact({
    captureDate: new Date("2026-09-19T20:00:01.000-03:00"),
    windows,
  }),
  "capture 20:00:01 INVALID",
);
ok(
  !isWithinCaptureWindowExact({ captureDate: null, windows }),
  "capture null NOT invented as valid",
);

// U — upload boundaries [16:00, 22:00)
ok(
  !isWithinUploadWindow(windows, fixedClock(new Date("2026-09-19T15:59:59.000-03:00"))),
  "upload 15:59:59 REJECT",
);
ok(
  getUploadWindowState(windows, fixedClock(new Date("2026-09-19T15:59:59.000-03:00"))) ===
    "NOT_OPEN",
  "upload NOT_OPEN before 16:00",
);
ok(
  isWithinUploadWindow(windows, fixedClock(new Date("2026-09-19T16:00:00.000-03:00"))),
  "upload 16:00:00 ACCEPT",
);
ok(
  isWithinUploadWindow(windows, fixedClock(new Date("2026-09-19T19:59:59.000-03:00"))),
  "upload 19:59:59 ACCEPT",
);
ok(
  isWithinUploadWindow(windows, fixedClock(new Date("2026-09-19T20:00:00.000-03:00"))),
  "upload 20:00:00 ACCEPT (capture closed)",
);
ok(
  isCaptureClosedUploadOpen(windows, fixedClock(new Date("2026-09-19T20:00:00.000-03:00"))),
  "20:00 capture-closed upload-open UX phase",
);
ok(
  isWithinUploadWindow(windows, fixedClock(new Date("2026-09-19T21:59:59.000-03:00"))),
  "upload 21:59:59 ACCEPT",
);
ok(
  !isWithinUploadWindow(windows, fixedClock(new Date("2026-09-19T22:00:00.000-03:00"))),
  "upload 22:00:00 REJECT",
);
ok(
  getUploadWindowState(windows, fixedClock(new Date("2026-09-19T22:00:00.000-03:00"))) ===
    "CLOSED",
  "upload CLOSED at 22:00",
);
ok(
  !isWithinUploadWindow(windows, fixedClock(new Date("2026-09-19T22:00:01.000-03:00"))),
  "upload 22:00:01 REJECT",
);

// V — cross cases (capture vs upload)
ok(
  isWithinCaptureWindowExact({
    captureDate: new Date("2026-09-19T19:50:00.000-03:00"),
    windows,
  }) &&
    isWithinUploadWindow(windows, fixedClock(new Date("2026-09-19T21:50:00.000-03:00"))),
  "cross: capture 19:50 + upload 21:50 VALID",
);
ok(
  !isWithinCaptureWindowExact({
    captureDate: new Date("2026-09-19T20:05:00.000-03:00"),
    windows,
  }),
  "cross: capture 20:05 INVALID CAPTURE",
);
ok(
  !isWithinCaptureWindowExact({
    captureDate: new Date("2026-09-19T15:55:00.000-03:00"),
    windows,
  }),
  "cross: capture 15:55 INVALID CAPTURE",
);
ok(
  !isWithinUploadWindow(windows, fixedClock(new Date("2026-09-19T22:01:00.000-03:00"))),
  "cross: upload 22:01 REJECTED",
);
ok(
  isWithinCaptureWindowExact({
    captureDate: new Date("2026-09-19T19:59:00.000-03:00"),
    windows,
  }) &&
    isWithinUploadWindow(windows, fixedClock(new Date("2026-09-19T21:59:00.000-03:00"))),
  "cross: capture 19:59 + upload 21:59 VALID",
);

// W — 8/10 counts only capture-valid
ok(
  resolveCompetitiveEligibility({
    validPromptCount: countCaptureValidPrompts(
      Array.from({ length: 8 }, () => ({ captureValidity: "CAPTURE_VALID" as const })),
    ),
    totalPrompts: 10,
    minValidPrompts: 8,
  }).status === "ELIGIBLE",
  "8 capture-valid → ELIGIBLE",
);
ok(
  resolveCompetitiveEligibility({
    validPromptCount: countCaptureValidPrompts([
      ...Array.from({ length: 7 }, () => ({ captureValidity: "CAPTURE_VALID" as const })),
      { captureValidity: "CAPTURE_INVALID" },
    ]),
    totalPrompts: 10,
    minValidPrompts: 8,
  }).status === "INCOMPLETE",
  "7 valid + 1 outside capture → NOT ELIGIBLE (INCOMPLETE)",
);
ok(
  resolveCompetitiveEligibility({
    validPromptCount: countCaptureValidPrompts([
      ...Array.from({ length: 8 }, () => ({ captureValidity: "CAPTURE_VALID" as const })),
      { captureValidity: "CAPTURE_INVALID" },
      { captureValidity: "CAPTURE_INVALID" },
    ]),
    totalPrompts: 10,
    minValidPrompts: 8,
  }).status === "ELIGIBLE",
  "8 valid + 2 invalid capture → ELIGIBLE",
);
ok(ARGENTINA_2026_RULES.allowCrossPromptDuplicate === false, "no cross-prompt duplicate");
ok(ARGENTINA_2026_RULES.maxPhotosPerPrompt === 1, "1 photo/prompt");

// C — EXIF evaluateCaptureDate exclusive end (tol=0)
const exifPass = evaluateCaptureDate({
  captureDate: new Date("2026-09-19T19:59:59.000-03:00"),
  windows,
  toleranceMinutes: 0,
  timezone: ARGENTINA_2026_TIMEZONE,
});
ok(exifPass.result === "PASS", "EXIF 19:59:59 PASS");
const exifOut = evaluateCaptureDate({
  captureDate: new Date("2026-09-19T20:00:00.000-03:00"),
  windows,
  toleranceMinutes: 0,
  timezone: ARGENTINA_2026_TIMEZONE,
});
ok(exifOut.result === "FAIL" || exifOut.result === "MANUAL_REVIEW", "EXIF 20:00 outside");
const exifEarly = evaluateCaptureDate({
  captureDate: new Date("2026-09-19T15:00:00.000-03:00"),
  windows,
  toleranceMinutes: 0,
  timezone: ARGENTINA_2026_TIMEZONE,
});
ok(exifEarly.result === "FAIL" || exifEarly.result === "MANUAL_REVIEW", "EXIF 15:00 outside");

// D — edit rules + AI flag
ok(classifyEditTechnique("exposure") === "ALLOWED", "edit allowed");
ok(classifyEditTechnique("ai_generation") === "FORBIDDEN", "edit forbidden");
ok(buildAiSuspectReviewFlag("metadata").flag === AI_OR_MANIPULATION_SUSPECTED, "AI flag");

// E — 4 criteria 1–10
ok(ARGENTINA_2026_RULES.juryCriteria.length === 3, "3 criteria (15B/16A)");
ok(ARGENTINA_2026_RULES.juryCriteria.every((c) => c.min === 1 && c.max === 10), "1–10");
ok(ARGENTINA_2026_RULES.socialVotingHours === 24, "public vote default 24h");

// F — top 3
const top = selectTopFinalistsByScore(
  [
    { entryId: "a", score: 9, eligible: true },
    { entryId: "b", score: 8, eligible: true },
    { entryId: "c", score: 7, eligible: true },
    { entryId: "d", score: 6, eligible: true },
    { entryId: "e", score: 10, eligible: false },
  ],
  3,
);
ok(top.length === 3 && top[0]!.entryId === "a", "top 3");

// G/I — 72h + likes winner / tie
const pub = new Date("2026-09-20T12:00:00.000Z");
const closes = votingClosesAt(pub, 72);
ok(closes.getTime() - pub.getTime() === 72 * 3600_000, "72h voting");
ok(resolveWinnerByLikes([{ entryId: "x", validLikes: 10 }, { entryId: "y", validLikes: 5 }]).status === "WINNER", "likes winner");
ok(resolveWinnerByLikes([{ entryId: "x", validLikes: 3 }, { entryId: "y", validLikes: 3 }]).status === "MANUAL_REVIEW_REQUIRED", "likes tie");

// J — prize bundles
ok(assignRandomAvailableBundle({ bundles: [{ id: "p1", name: "A", status: "AVAILABLE" }], random: () => 0 }).bundleId === "p1", "prize assign");

// O/P — royalty
const roy = computePhotographerRoyalty({
  productKind: "INDIVIDUAL",
  productPaidAmountMinor: 10_000_000,
  shippingPaidAmountMinor: 1_000_000,
});
ok(roy.royaltyMinor === 2_000_000, "royalty 20% of product only");
ok(roy.buyerTotalMinor === 11_000_000, "buyer total");
ok(
  computePhotographerRoyalty({
    productKind: "COLLECTIVE_PRODUCT",
    productPaidAmountMinor: 10_000_000,
    shippingPaidAmountMinor: 0,
  }).royaltyMinor === 0,
  "collective 0%",
);

// Q — business days (Fri + 1 business day → Mon)
const fri = new Date(Date.UTC(2026, 8, 18)); // Fri
const mon = addBusinessDays(fri, 1);
ok(mon.getUTCDay() === 1, "business day skip weekend");
ok(addBusinessDays(new Date(Date.UTC(2026, 8, 1)), 15) > new Date(Date.UTC(2026, 8, 16)), "15 business > 15 calendar");

// T — license expiration
const lic = commercialLicenseForFinalist({ selectedAt: new Date("2026-09-20") });
ok(shouldUnpublishForNewSales(lic.endsAt, new Date("2027-09-20T03:00:00.000Z")), "license end unpublish");
ok(lic.copyrightTransfer === false, "no copyright transfer");
ok(lic.allowsFulfillmentOfPaidOrders === true, "fulfill paid after expiry");

// W — returning 7 days
const { startsAt, expiresAt } = returningWindow({
  sourceEditionEndedAt: new Date("2026-09-19T22:00:00.000-03:00"),
  days: 7,
});
const uid = 42;
ok(
  evaluateReturningParticipantEarlyPrice({
    userId: uid,
    entitlementUserId: uid,
    targetEditionId: "next",
    entitlementTargetEditionId: "next",
    startsAt,
    expiresAt,
    usedAt: null,
    now: new Date(startsAt.getTime() + 1 * 86400_000),
  }).eligible,
  "day 1 eligible",
);
ok(
  evaluateReturningParticipantEarlyPrice({
    userId: uid,
    entitlementUserId: uid,
    targetEditionId: "next",
    entitlementTargetEditionId: "next",
    startsAt,
    expiresAt,
    usedAt: null,
    now: new Date(startsAt.getTime() + 7 * 86400_000),
  }).eligible,
  "day 7 eligible",
);
ok(
  !evaluateReturningParticipantEarlyPrice({
    userId: uid,
    entitlementUserId: uid,
    targetEditionId: "next",
    entitlementTargetEditionId: "next",
    startsAt,
    expiresAt,
    usedAt: null,
    now: new Date(startsAt.getTime() + 8 * 86400_000),
  }).eligible,
  "day 8 not eligible",
);
ok(
  !evaluateReturningParticipantEarlyPrice({
    userId: 99,
    entitlementUserId: uid,
    targetEditionId: "next",
    entitlementTargetEditionId: "next",
    startsAt,
    expiresAt,
    usedAt: null,
    now: new Date(startsAt.getTime() + 1 * 86400_000),
  }).eligible,
  "other user no",
);

// X/Z — annual pass ×4 + idempotent consume
ok(annualPassPriceMinor(2_500_000) === 10_000_000, "pass ×4");
const first = consumeAnnualPassOnPromptsAccess({
  status: "ACTIVE",
  totalCredits: 4,
  consumedCredits: 0,
  alreadyConsumedForEdition: false,
});
ok(first.consumed === true && first.consumedCredits === 1, "first access consumes");
ok(
  consumeAnnualPassOnPromptsAccess({
    status: "ACTIVE",
    totalCredits: 4,
    consumedCredits: 1,
    alreadyConsumedForEdition: true,
  }).consumed === false,
  "refresh idempotent",
);

// AC — one transfer then expire
ok(transferUnusedIndividualRegistration({ transferCount: 0, maxTransfers: 1, participated: false }).ok, "transfer once");
ok(!transferUnusedIndividualRegistration({ transferCount: 1, maxTransfers: 1, participated: false }).ok, "no third");
ok(expireAfterSecondMiss({ transferCount: 1, maxTransfers: 1, participatedSecondChance: false }) === "EXPIRED", "expired");

// AF — minor gate
ok(
  evaluateMinorGate({
    birthDate: new Date("2015-01-01"),
    eventDate: new Date("2026-09-19"),
  }).ok === false,
  "minor without auth rejected",
);
const minorOk = evaluateMinorGate({
  birthDate: new Date("2015-01-01"),
  eventDate: new Date("2026-09-19"),
  adultName: "Adulto",
  adultAuthorizationAcceptedAt: new Date(),
});
ok(
  minorOk.ok &&
    minorOk.isMinor &&
    minorOk.legalFieldsStatus === "MINOR_LEGAL_FIELDS_REVIEW_REQUIRED",
  "minor legal fields review",
);

// AG — terms version
ok(CLICKATON_TERMS_VERSION.startsWith("CLICKATON_TERMS_"), "terms version");
ok(ARGENTINA_2026_RULES.weatherAutoCancel === false, "no weather auto-cancel");

console.log(JSON.stringify({ ok: true, checks: n, termsVersion: CLICKATON_TERMS_VERSION }));
