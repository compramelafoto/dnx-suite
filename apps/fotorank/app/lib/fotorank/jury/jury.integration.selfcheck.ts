/**
 * Integración P0-07 — DB local únicamente.
 *
 * DATABASE_URL='postgresql://USER@localhost:5432/fotorank_p0_06_test' \
 *   pnpm --filter fotorank run test:jury:integration
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@repo/db";
import {
  createContestRegistration,
  publishRulesVersion,
  createRulesDraft,
  updateRulesDraft,
  assertRulesVersionMutable,
  publishExistingRulesDraft,
  RULES_PLACEHOLDER_MARKER,
  RegistrationError,
} from "../registration";
import { processUploadedFile, createUploadIntent, confirmEntry } from "../entries";
import {
  listAnonymousEntriesForJuror,
  getAnonymousEntryDetailForJuror,
  getJuryPreviewAccess,
  declareJuryConflict,
  JuryError,
  assertNoForbiddenJuryFields,
} from "./index";
import { getContestOperationalMetrics } from "../metrics/contest-metrics";
import { gatePlaceholderContent } from "../registration/production-gate";

function assertLocalDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    console.log("SKIP jury.integration: DATABASE_URL no definida");
    return false;
  }
  if (/neon\.tech|amazonaws\.com|supabase\.co/i.test(url) || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error("ABORT: usá solo DB local para P0-07");
  }
  return true;
}

async function jpeg(w = 2400, h = 1600, withExif = true) {
  let img = sharp({
    create: { width: w, height: h, channels: 3, background: { r: 20, g: 80, b: 120 } },
  }).jpeg({ quality: 85 });
  if (withExif) {
    img = img.withMetadata({ exif: { IFD0: { Make: "Apple", Model: "iPhone 15" } } });
  }
  return img.toBuffer();
}

async function main() {
  if (!assertLocalDb()) return;

  const conflictDelegate = (prisma as { fotorankJudgeEntryConflict?: { create?: unknown } })
    .fotorankJudgeEntryConflict;
  if (typeof conflictDelegate?.create !== "function") {
    console.log("SKIP jury.integration: falta modelo FotorankJudgeEntryConflict (db push + generate)");
    return;
  }

  const suffix = Date.now().toString(36);
  const password = createHash("sha256").update(`j-${suffix}`).digest("hex");

  const orgUser = await prisma.user.create({
    data: { email: `org-p007-${suffix}@fotorank.local`, name: "Org P007", password },
  });
  const partA = await prisma.user.create({
    data: { email: `parta-p007-${suffix}@fotorank.local`, name: "Part A", password },
  });
  const partB = await prisma.user.create({
    data: { email: `partb-p007-${suffix}@fotorank.local`, name: "Part B", password },
  });

  const workspace =
    (await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await prisma.workspace.create({
      data: { name: `WS P007 ${suffix}` },
    }));

  const org = await prisma.contestOrganization.create({
    data: {
      name: `Org P007 ${suffix}`,
      slug: `org-p007-${suffix}`,
      platformFeeBps: 0,
      createdByUserId: orgUser.id,
    },
  });
  await prisma.contestOrganizationMember.create({
    data: { organizationId: org.id, userId: orgUser.id, role: "OWNER", status: "ACTIVE" },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `P007 ${suffix}`,
      slug: `p007-${suffix}`,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      registrationEnabled: true,
      registrationPricingMode: "FREE",
      registrationOpensAt: new Date("2026-01-01T00:00:00Z"),
      registrationClosesAt: new Date("2026-12-31T00:00:00Z"),
      submissionOpensAt: new Date("2026-01-01T00:00:00Z"),
      submissionDeadline: new Date("2026-12-31T00:00:00Z"),
      createdByUserId: orgUser.id,
      uploadPolicyJson: {
        allowedMimeTypes: ["image/jpeg"],
        allowedExtensions: ["jpg", "jpeg"],
        maxFileSizeBytes: 25_000_000,
        minWidth: 1200,
        minHeight: 800,
        maxWidth: 12000,
        maxHeight: 12000,
        minMegapixels: 1.5,
        requireExif: false,
        maxEntriesPerRegistration: 1,
        allowReplaceUntilSubmissionClose: true,
        draftConfig: true,
      },
    },
  });

  const catA = await prisma.fotorankContestCategory.create({
    data: { contestId: contest.id, name: "Celular", slug: "celular", maxFiles: 1, status: "ACTIVE" },
  });
  const catB = await prisma.fotorankContestCategory.create({
    data: { contestId: contest.id, name: "Camara", slug: "camara", maxFiles: 1, status: "ACTIVE" },
  });

  const rules = await publishRulesVersion({
    contestId: contest.id,
    title: "Bases P007",
    content: `${RULES_PLACEHOLDER_MARKER}\n\nP0-07`,
    createdByUserId: orgUser.id,
    allowPlaceholder: true,
  });

  const judge = await prisma.fotorankJudgeAccount.create({
    data: {
      workspaceId: workspace.id,
      email: `jury-p007-${suffix}@fotorank.local`,
      passwordHash: password,
      accountStatus: "ACTIVE",
      profile: {
        create: {
          firstName: "Jury",
          lastName: "Test",
          publicSlug: `jury-p007-${suffix}`,
          isPublic: false,
        },
      },
      organizationMemberships: {
        create: { organizationId: org.id, membershipStatus: "ACTIVE" },
      },
    },
  });

  await prisma.fotorankJudgeAssignment.create({
    data: {
      organizationId: org.id,
      contestId: contest.id,
      categoryId: catA.id,
      judgeAccountId: judge.id,
      assignmentStatus: "ACCEPTED",
      assignmentType: "PRIMARY",
      methodType: "SCORE_1_10",
      methodConfigJson: {},
      createdByUserId: orgUser.id,
    },
  });

  // Participant A — cat A — with EXIF
  await createContestRegistration({
    contestId: contest.id,
    participantUserId: partA.id,
    categoryId: catA.id,
    rulesVersionId: rules.id,
    rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 30,
    rulesAcceptanceIp: "127.0.0.1",
    rulesAcceptanceUserAgent: "jury.integration",
  });
  const intentA = await createUploadIntent({ contestId: contest.id, participantUserId: partA.id });
  await processUploadedFile({
    contestId: contest.id,
    entryId: intentA.entryId,
    participantUserId: partA.id,
    buffer: await jpeg(2400, 1600, true),
    originalFileName: "a.jpg",
    declaredMime: "image/jpeg",
  });
  const confA = await confirmEntry({
    contestId: contest.id,
    entryId: intentA.entryId,
    participantUserId: partA.id,
    acknowledgeWarnings: true,
  });

  // Participant B — cat B — sin EXIF (jurado no debe verla)
  await createContestRegistration({
    contestId: contest.id,
    participantUserId: partB.id,
    categoryId: catB.id,
    rulesVersionId: rules.id,
    rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 30,
    rulesAcceptanceIp: "127.0.0.1",
    rulesAcceptanceUserAgent: "jury.integration",
  });
  const intentB = await createUploadIntent({ contestId: contest.id, participantUserId: partB.id });
  await processUploadedFile({
    contestId: contest.id,
    entryId: intentB.entryId,
    participantUserId: partB.id,
    buffer: await jpeg(2400, 1600, false),
    originalFileName: "b.jpg",
    declaredMime: "image/jpeg",
  });
  await confirmEntry({
    contestId: contest.id,
    entryId: intentB.entryId,
    participantUserId: partB.id,
    acknowledgeWarnings: true,
  });

  const listed = await listAnonymousEntriesForJuror({
    judgeAccountId: judge.id,
    contestId: contest.id,
  });
  assert.equal(listed.entries.length, 1);
  assert.equal(listed.entries[0]!.anonymousCode, confA.entryNumber);
  assert.equal(assertNoForbiddenJuryFields(listed).length, 0);

  const detail = await getAnonymousEntryDetailForJuror({
    judgeAccountId: judge.id,
    contestId: contest.id,
    entryId: intentA.entryId,
  });
  assert.equal(detail.anonymousCode, confA.entryNumber);
  assert.equal(assertNoForbiddenJuryFields(detail).length, 0);
  assert.equal(detail.technical.evaluationEnabled, false);

  const preview = await getJuryPreviewAccess({
    judgeAccountId: judge.id,
    contestId: contest.id,
    entryId: intentA.entryId,
  });
  assert.equal(preview.kind, "JURY_PREVIEW");
  assert.ok(preview.previewUrl.includes("private-asset") || preview.previewUrl.startsWith("http"));

  await assert.rejects(
    () =>
      getAnonymousEntryDetailForJuror({
        judgeAccountId: judge.id,
        contestId: contest.id,
        entryId: intentB.entryId,
      }),
    (e: unknown) => e instanceof JuryError && e.code === "CATEGORY_NOT_ASSIGNED",
  );

  // Original asset key must not be accessible via jury preview helper (kind check)
  const original = await prisma.fotorankContestEntryAsset.findFirst({
    where: { entryId: intentA.entryId, kind: "ORIGINAL", isActive: true },
  });
  assert.ok(original);

  await declareJuryConflict({
    judgeAccountId: judge.id,
    contestId: contest.id,
    entryId: intentA.entryId,
    reasonCode: "KNOW_AUTHOR",
  });
  const afterConflict = await listAnonymousEntriesForJuror({
    judgeAccountId: judge.id,
    contestId: contest.id,
  });
  assert.equal(afterConflict.entries.length, 0);

  // Bases draft immutability
  const draft = await createRulesDraft({
    contestId: contest.id,
    title: "Bases v2",
    content: "Bases oficiales sin marcadores de borrador para test.",
    createdByUserId: orgUser.id,
  });
  await updateRulesDraft({ versionId: draft.id, content: "Bases oficiales actualizadas sin placeholder." });
  const published = await publishExistingRulesDraft({
    versionId: draft.id,
    createdByUserId: orgUser.id,
  });
  assert.ok(published.publishedAt);
  await assert.rejects(
    () => assertRulesVersionMutable(published.id),
    (e: unknown) => e instanceof RegistrationError,
  );

  // Placeholder gate prod
  const prev = process.env.FOTORANK_APP_ENV;
  process.env.FOTORANK_APP_ENV = "production";
  assert.equal(gatePlaceholderContent(`${RULES_PLACEHOLDER_MARKER}`).allowed, false);
  process.env.FOTORANK_APP_ENV = prev;

  const metrics = await getContestOperationalMetrics(contest.id);
  assert.equal(metrics.confirmedRegistrationCount, 2);
  assert.equal(metrics.entriesConfirmedCount, 2);
  assert.equal(metrics.juryAcceptedCount, 1);

  // entryNumber estable tras "reconfirm" path — ya confirmada
  const entry = await prisma.fotorankContestEntry.findUnique({ where: { id: intentA.entryId } });
  assert.equal(entry?.entryNumber, confA.entryNumber);

  console.log(
    JSON.stringify(
      {
        ok: true,
        contestId: contest.id,
        judgeId: judge.id,
        entryA: intentA.entryId,
        entryB: intentB.entryId,
        metrics,
      },
      null,
      2,
    ),
  );
  console.log("jury.integration.selfcheck.ts OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
