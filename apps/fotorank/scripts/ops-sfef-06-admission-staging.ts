/**
 * ETAPA 06 — validación staging (DB round-fog) de admisión: estados, ARGRA, evidencia, freeze.
 * No usa PII real / ARGRA real / fotos personales.
 *
 * Uso (env staging ya cargado):
 *   pnpm --filter @repo/db exec tsx ../../apps/fotorank/scripts/ops-sfef-06-admission-staging.ts
 */
import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@repo/db";
import {
  admitEntry,
  allowReplacement,
  freezeAdmittedEntries,
  listAdmissionQueue,
  rejectEntry,
  requestEvidence,
  verifyArgra,
} from "../app/lib/fotorank/admission";
import { assertAnonymousPayloadClean, buildAnonymousJuryPayload } from "../app/lib/fotorank/admission/anonymity";
import { evaluateAdmissionAutoMatrix } from "../app/lib/fotorank/admission/auto-matrix";

const KEY_LEN = 64;
const PASSWORD = "Sfef06-Test-Only!";

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${digest}`;
}

function assertStaging() {
  const url = process.env.DATABASE_URL ?? "";
  const host = new URL(url).hostname;
  if (!host.includes("ep-round-fog") || host.includes("dawn-dew")) {
    throw new Error(`ABORT host no staging: ${host}`);
  }
}

function elig(decision: string, reasonCode: string) {
  return {
    decision: decision as never,
    reasonCode: reasonCode as never,
    publicMessage: "p",
    internalMessage: "i",
    evidence: {},
  };
}

async function main() {
  assertStaging();
  const runId = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const results: Record<string, string> = {};

  // Matriz unitaria embebida
  const amateurPass = evaluateAdmissionAutoMatrix({
    deviceEval: elig("ELIGIBLE", "AMATEUR_DEVICE_ALLOWED"),
    territoryEval: elig("DECLARED_VALID", "TERRITORY_DECLARED_VALID"),
    captureEval: elig("WITHIN_CAPTURE_WINDOW", "CAPTURE_WITHIN_WINDOW"),
    argraStatus: "NOT_REQUIRED",
    categoryRequiresArgra: false,
    checklistHasBlockingFail: false,
    checklistRequiresReview: false,
    duplicateSuspected: false,
    exifMissing: false,
    gpsPresent: false,
    softwarePresent: false,
  });
  if (amateurPass.admissionStatus !== "ELIGIBLE") throw new Error("case1 matrix fail");
  results.case1_matrix = "PASS";

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: "santa-fe-en-foco" },
    include: {
      categories: { where: { status: "ACTIVE" } },
      organization: { select: { id: true } },
    },
  });
  if (!contest) throw new Error("contest missing");

  const orgMember = await prisma.contestOrganizationMember.findFirst({
    where: {
      organizationId: contest.organizationId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "EDITOR"] },
    },
  });
  if (!orgMember) throw new Error("no organizer member on staging contest org");
  const organizerUserId = orgMember.userId;

  const amateurCat = contest.categories.find((c) => c.slug === "fotografo-amateur");
  const reporterCat = contest.categories.find((c) => c.slug === "reportero-grafico");
  const proCat = contest.categories.find((c) => c.slug === "fotografo-profesional");
  if (!amateurCat || !reporterCat || !proCat) throw new Error("categories missing");

  const rulesVersion = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: contest.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!rulesVersion) throw new Error("rulesVersion missing for contest");
  const rulesVersionId = rulesVersion.id;

  async function makeUser(key: string) {
    return prisma.user.create({
      data: {
        email: `sfef06-${key}-${runId}@fotorank.test`,
        name: `SFEF06 ${key}`,
        password: hashPassword(PASSWORD),
        province: "Córdoba",
        country: "Argentina",
        emailVerifiedAt: new Date(),
      },
    });
  }

  async function makeEntry(opts: {
    userId: number;
    categoryId: string;
    admissionStatus: "ELIGIBLE" | "PENDING_MANUAL_REVIEW" | "ADMITTED";
    answersJson?: object;
    metadata?: object;
  }) {
    const reg = await prisma.fotorankContestRegistration.create({
      data: {
        contestId: contest!.id,
        categoryId: opts.categoryId,
        participantUserId: opts.userId,
        status: "CONFIRMED",
        paymentStatus: "NOT_REQUIRED",
        paymentModeSnapshot: "FREE",
        registrationNumber: `SFEF06-${runId}-${randomBytes(2).toString("hex")}`.slice(0, 32),
        rulesVersionId,
        rulesAcceptedAt: new Date(),
        registeredAt: new Date(),
        confirmedAt: new Date(),
        licenseAccepted: true,
        licenseAcceptedAt: new Date(),
        declaredAgeYears: 30,
        answersJson: opts.answersJson ?? {},
      },
    });
    return prisma.fotorankContestEntry.create({
      data: {
        contestId: contest!.id,
        categoryId: opts.categoryId,
        registrationId: reg.id,
        authorUserId: opts.userId,
        status: "CONFIRMED",
        technicalSummaryStatus:
          opts.admissionStatus === "PENDING_MANUAL_REVIEW" ? "REQUIRES_REVIEW" : "APPROVED",
        manualReviewStatus: opts.admissionStatus === "PENDING_MANUAL_REVIEW" ? "PENDING" : "NONE",
        admissionStatus: opts.admissionStatus,
        submittedAt: new Date(),
        confirmedAt: new Date(),
        imageUrl: "",
        title: `SFEF06 ${runId}`,
        metadataJson: {
          eligibility: {
            captureLocality: "Rosario",
            territoryConfirmedSantaFe: true,
            declaredDeviceKind: "SMARTPHONE",
            gpsPresent: false,
          },
          admissionOps: { lastReasonCodes: [], rulesVersion: "santa-fe-admission-draft-v1" },
          ...(opts.metadata ?? {}),
        },
      },
    });
  }

  // Caso 1 — auto-pass → admit
  const u1 = await makeUser("amateur");
  const e1 = await makeEntry({
    userId: u1.id,
    categoryId: amateurCat.id,
    admissionStatus: "ELIGIBLE",
  });
  const admit1 = await admitEntry({
    contestId: contest.id,
    entryId: e1.id,
    organizerUserId,
    reasonCode: "ADMISSION_APPROVED",
    notes: "SFEF06 case1",
    requestId: `sfef06-admit-${runId}-1`,
  });
  if (admit1.admissionStatus !== "ADMITTED") throw new Error("case1 admit fail");
  results.case1_admit = "PASS";

  // Caso 2 — profesional celular → replacement
  const u2 = await makeUser("pro");
  const e2 = await makeEntry({
    userId: u2.id,
    categoryId: proCat.id,
    admissionStatus: "PENDING_MANUAL_REVIEW",
    metadata: {
      eligibility: {
        captureLocality: "Santa Fe",
        territoryConfirmedSantaFe: true,
        declaredDeviceKind: "SMARTPHONE",
        deviceReasonCode: "PROFESSIONAL_PHONE_NOT_ALLOWED",
        gpsPresent: false,
      },
    },
  });
  const repl = await allowReplacement({
    contestId: contest.id,
    entryId: e2.id,
    organizerUserId,
    reasonCode: "REPLACEMENT_ALLOWED",
    requestId: `sfef06-repl-${runId}`,
  });
  if (repl.manualReviewStatus !== "REPLACEMENT_REQUESTED") throw new Error("case2 replace fail");
  results.case2_replacement = "PASS";

  // Caso 3 — ARGRA
  const u3 = await makeUser("reporter");
  const e3 = await makeEntry({
    userId: u3.id,
    categoryId: reporterCat.id,
    admissionStatus: "PENDING_MANUAL_REVIEW",
    answersJson: {
      argraMembershipNumber: "TEST-999",
      argraVerificationStatus: "PENDING_VERIFICATION",
    },
  });
  try {
    await admitEntry({
      contestId: contest.id,
      entryId: e3.id,
      organizerUserId,
      reasonCode: "ADMISSION_APPROVED",
    });
    throw new Error("case3 should block admit without VERIFIED");
  } catch (err) {
    if (!(err instanceof Error) || !String(err.message).includes("ARGRA")) {
      // AdmissionError
      const msg = err instanceof Error ? err.message : "";
      if (!msg.toLowerCase().includes("argra")) throw err;
    }
  }
  await verifyArgra({
    contestId: contest.id,
    entryId: e3.id,
    organizerUserId,
    status: "VERIFIED",
    internalNote: "SFEF06 synthetic",
  });
  const admit3 = await admitEntry({
    contestId: contest.id,
    entryId: e3.id,
    organizerUserId,
    reasonCode: "ADMISSION_APPROVED",
    requestId: `sfef06-admit-${runId}-3`,
  });
  if (admit3.admissionStatus !== "ADMITTED") throw new Error("case3 admit after verify fail");
  results.case3_argra = "PASS";

  // Caso 4 — evidencia aérea-like
  const u4 = await makeUser("aerial");
  const aerialCat = contest.categories.find((c) => c.slug === "fotografia-aerea")!;
  const e4 = await makeEntry({
    userId: u4.id,
    categoryId: aerialCat.id,
    admissionStatus: "PENDING_MANUAL_REVIEW",
  });
  const ev = await requestEvidence({
    contestId: contest.id,
    entryId: e4.id,
    organizerUserId,
    types: ["DEVICE_CLARIFICATION", "ORIGINAL"],
    reasonCode: "AERIAL_DEVICE_NOT_IDENTIFIED",
    publicMessage: "Necesitamos evidencia del dron (síntetico SFEF06).",
  });
  if (ev.evidenceRequest.status !== "OPEN") throw new Error("case4 evidence fail");
  results.case4_evidence = "PASS";

  // Caso 5 — fecha fuera → reject auditado
  const u5 = await makeUser("date");
  const e5 = await makeEntry({
    userId: u5.id,
    categoryId: amateurCat.id,
    admissionStatus: "PENDING_MANUAL_REVIEW",
  });
  const rej = await rejectEntry({
    contestId: contest.id,
    entryId: e5.id,
    organizerUserId,
    reasonCode: "CAPTURE_DATE_BEFORE_WINDOW",
    publicMessage: "Fecha fuera de período (fixture SFEF06).",
    internalNote: "excepción no aplicada",
  });
  if (rej.admissionStatus !== "REJECTED") throw new Error("case5 reject fail");
  results.case5_reject = "PASS";

  // Caso 6 — GPS inconsistente → evidencia territorial
  const u6 = await makeUser("gps");
  const e6 = await makeEntry({
    userId: u6.id,
    categoryId: amateurCat.id,
    admissionStatus: "PENDING_MANUAL_REVIEW",
  });
  await requestEvidence({
    contestId: contest.id,
    entryId: e6.id,
    organizerUserId,
    types: ["LOCATION_EVIDENCE"],
    reasonCode: "TERRITORY_EVIDENCE_REQUIRED",
  });
  results.case6_territory = "PASS";

  // Cola
  const queue = await listAdmissionQueue({
    contestId: contest.id,
    organizerUserId,
    filter: "requires_review",
    page: 1,
    pageSize: 25,
  });
  if (!Array.isArray(queue.items)) throw new Error("queue fail");
  results.queue = "PASS";

  // Caso 7 — freeze dry-run + apply (solo admitted del run + prev admitidas del contest)
  const dry = await freezeAdmittedEntries({
    contestId: contest.id,
    organizerUserId,
    dryRun: true,
    requestId: `sfef06-freeze-dry-${runId}`,
  });
  if (!dry.dryRun) throw new Error("dry-run flag");
  for (const sample of dry.samplePayloads ?? []) {
    if (sample.leaks.length) throw new Error(`anon leak: ${sample.leaks.join(",")}`);
    const leaks = assertAnonymousPayloadClean(
      buildAnonymousJuryPayload({
        anonymousCode: sample.payload.anonymousCode,
        categorySlug: sample.payload.categorySlug,
        categoryName: sample.payload.categoryName,
        title: sample.payload.title,
        description: sample.payload.description,
        hasJuryAsset: sample.payload.juryPreviewAvailable,
        entryId: sample.payload.entryId,
      }) as unknown as Record<string, unknown>,
    );
    if (leaks.length) throw new Error(`payload leak ${leaks.join(",")}`);
  }
  results.case7_freeze_dry = "PASS";

  // Apply solo sobre e1/e3 (ADMITTED). Otras ADMITTED previas del contest también se congelan — documentado.
  const applied = await freezeAdmittedEntries({
    contestId: contest.id,
    organizerUserId,
    dryRun: false,
    requestId: `sfef06-freeze-apply-${runId}`,
  });
  if (applied.dryRun) throw new Error("expected apply");
  const frozenE1 = await prisma.fotorankContestEntry.findUnique({ where: { id: e1.id } });
  if (frozenE1?.admissionStatus !== "FROZEN_FOR_JURY") throw new Error("e1 not frozen");
  const stillRejected = await prisma.fotorankContestEntry.findUnique({ where: { id: e5.id } });
  if (stillRejected?.admissionStatus !== "REJECTED") throw new Error("rejected was frozen!");
  const stillReview = await prisma.fotorankContestEntry.findUnique({ where: { id: e4.id } });
  if (stillReview?.admissionStatus === "FROZEN_FOR_JURY") throw new Error("review entry frozen!");
  results.case7_freeze_apply = "PASS";

  // Idempotencia admit
  const again = await admitEntry({
    contestId: contest.id,
    entryId: e1.id,
    organizerUserId,
    reasonCode: "ADMISSION_APPROVED",
  });
  // admitEntry sobre ADMITTED debe ser idempotente (status tipado como ADMITTED).
  results.idempotency = again.idempotent || again.admissionStatus === "ADMITTED" ? "PASS" : "FAIL";

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        organizerUserId,
        frozen: "frozen" in applied ? applied.frozen : null,
        results,
        fixtureEmails: [
          u1.email,
          u2.email,
          u3.email,
          u4.email,
          u5.email,
          u6.email,
        ],
        note: "Fixtures sintéticos SFEF06 — cleanup opcional por email prefix sfef06-",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
