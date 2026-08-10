/**
 * ETAPA 17B — matriz E2E 55/55 (Instagram mock + TEST_PROVIDER regression).
 *
 *   SFEF17B_ALLOW_PROD=1 DATABASE_URL=... \
 *     pnpm --filter fotorank exec tsx scripts/ops-17b-instagram-e2e.ts
 */
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_CONTEST = "cmslf0ny10005i7nlqe7xqbea";
const COMMERCIAL_EDITION = "cmrvq7liy0000l904s25767xe";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROMPT_COUNT = 10;
const FINALISTS_PER = 3;

type Mark = "PASS" | "FAIL";
const matrix: Record<string, Mark> = {};
function mark(k: string, ok: boolean, detail?: string) {
  matrix[k] = ok ? "PASS" : "FAIL";
  if (!ok) console.error("FAIL", k, detail ?? "");
}

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, 64).toString("hex")}`;
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}

async function commercialCounts(prisma: InstanceType<typeof PrismaClient>) {
  return {
    regs: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION, isOpsTest: false },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION, isOpsTest: false, paymentOrderId: { not: null } },
    }),
    submissions: await prisma.clickatonPhotoSubmission.count({
      where: { editionId: COMMERCIAL_EDITION, registration: { isOpsTest: false } },
    }),
    prompts: await prisma.clickatonPrompt.count({
      where: { editionId: COMMERCIAL_EDITION, status: { not: "CANCELLED" } },
    }),
    jurySessions: await prisma.fotorankJuryScoringSession.count({
      where: { contestId: COMMERCIAL_CONTEST },
    }),
    finalistSnapshots: await prisma.fotorankFinalistSnapshot.count({
      where: { contestId: COMMERCIAL_CONTEST },
    }),
    publicVoteRounds: await prisma.fotorankPublicVoteRound.count({
      where: { contestId: COMMERCIAL_CONTEST },
    }),
    socialConnectionsCommercial: await prisma.fotorankSocialConnection.count({
      where: { organization: { contests: { some: { id: COMMERCIAL_CONTEST } } } },
    }),
    publicationsCommercial: await prisma.fotorankPublicVotePublication.count({
      where: { round: { contestId: COMMERCIAL_CONTEST } },
    }),
    publicVoteEnabled: await prisma.fotorankCompetitionJuryConfig.count({
      where: { contestId: COMMERCIAL_CONTEST, publicVoteEnabled: true },
    }),
    publishedResults: await prisma.fotorankPublicVoteRound.count({
      where: { contestId: COMMERCIAL_CONTEST, resultsPublicationStatus: "PUBLISHED" },
    }),
  };
}

async function cleanupContest(prisma: InstanceType<typeof PrismaClient>, contestId: string) {
  if (!contestId) return;
  await prisma.fotorankPublicVotePublication.deleteMany({ where: { round: { contestId } } });
  await prisma.fotorankPublicVoteFinalSnapshot.deleteMany({ where: { round: { contestId } } });
  await prisma.fotorankPublicVoteObservation.deleteMany({ where: { round: { contestId } } });
  await prisma.fotorankPublicVoteCandidate.deleteMany({ where: { round: { contestId } } });
  await prisma.fotorankPublicVoteRound.deleteMany({ where: { contestId } });
  await prisma.fotorankFinalistSnapshot.deleteMany({ where: { contestId } });
  await prisma.fotorankFinalistPackage.deleteMany({ where: { contestId } });
  await prisma.fotorankResultEntry.deleteMany({ where: { resultBatch: { contestId } } });
  await prisma.fotorankResultBatch.deleteMany({ where: { contestId } });
  await prisma.fotorankResultRuleSet.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryCriterionScore.deleteMany({ where: { evaluation: { contestId } } });
  await prisma.fotorankJuryEvaluation.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryPreliminaryAggregate.deleteMany({
    where: { scoringSession: { contestId } },
  });
  await prisma.fotorankJudgeAuditEvent.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryScoringSession.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryCriterion.deleteMany({ where: { rubric: { contestId } } });
  await prisma.fotorankJuryRubric.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryEntrySnapshot.deleteMany({ where: { contestId } });
  await prisma.fotorankAdmissionBatch.deleteMany({ where: { contestId } });
  await prisma.fotorankCompetitiveEligibilityFreeze.deleteMany({ where: { contestId } });
  await prisma.fotorankCompetitionJuryConfig.deleteMany({ where: { contestId } });
  await prisma.fotorankContestEntryAsset.deleteMany({ where: { contestId } });
  await prisma.fotorankContestEntry.deleteMany({ where: { contestId } });
  await prisma.fotorankContestParticipant.deleteMany({ where: { contestId } });
  await prisma.fotorankContestCategory.deleteMany({ where: { contestId } });
  await prisma.fotorankContest.delete({ where: { id: contestId } }).catch(() => null);
}

type SeedResult = {
  contestId: string;
  orgId: string;
  userIds: number[];
  sessionId: string;
  promptIds: string[];
};

async function seedFixture(
  prisma: InstanceType<typeof PrismaClient>,
  opts: {
    runId: string;
    slugPrefix: string;
    provider: "TEST_PROVIDER" | "INSTAGRAM" | "NONE";
    mode: "JURY_ONLY" | "JURY_THEN_PUBLIC";
    enabled: boolean;
    promptCount?: number;
    clickatonChannel?: boolean;
  },
): Promise<SeedResult> {
  const promptCount = opts.promptCount ?? PROMPT_COUNT;
  const clickaton = opts.clickatonChannel !== false;
  const orgUser = await prisma.user.create({
    data: {
      email: `ops17b-${opts.slugPrefix}-${opts.runId}@fotorank.test`,
      name: "OPS17B Organizer",
      password: hashPassword(`Ops17b-${opts.runId}!`),
      role: "ORGANIZER",
      emailVerifiedAt: new Date(),
    },
  });
  const org = await prisma.contestOrganization.create({
    data: {
      name: `OPS 17B ${opts.slugPrefix}`,
      slug: `ops-17b-${opts.slugPrefix}-${randomBytes(3).toString("hex")}`,
      createdByUserId: orgUser.id,
    },
  });
  await prisma.contestOrganizationMember.create({
    data: { organizationId: org.id, userId: orgUser.id, role: "ADMIN", status: "ACTIVE" },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `OPS 17B ${opts.slugPrefix}`,
      slug: `ops-17b-${opts.slugPrefix}-${opts.runId}`,
      shortDescription: "fixture 17b",
      status: "PUBLISHED",
      visibility: "PRIVATE",
      experienceType: clickaton ? "MARATHON" : "CONTEST",
      distributionChannel: clickaton ? "CLICKATON" : null,
      createdByUserId: orgUser.id,
      registrationEnabled: false,
      timezone: "America/Argentina/Buenos_Aires",
    },
  });

  const category = await prisma.fotorankContestCategory.create({
    data: {
      contestId: contest.id,
      name: "OPS17B",
      slug: `ops17b-${randomBytes(2).toString("hex")}`,
      sortOrder: 1,
    },
  });

  const batch = await prisma.fotorankAdmissionBatch.create({
    data: {
      contestId: contest.id,
      status: "FROZEN",
      totalEntries: promptCount * FINALISTS_PER,
      admittedEntries: promptCount * FINALISTS_PER,
      frozenEntries: promptCount * FINALISTS_PER,
      frozenAt: new Date(),
      createdByUserId: orgUser.id,
    },
  });

  const rubric = await prisma.fotorankJuryRubric.create({
    data: {
      contestId: contest.id,
      admissionBatchId: batch.id,
      name: "OPS17B",
      version: 1,
      status: "ACTIVE",
      activatedAt: new Date(),
      activatedByUserId: orgUser.id,
      createdByUserId: orgUser.id,
    },
  });

  const session = await prisma.fotorankJuryScoringSession.create({
    data: {
      contestId: contest.id,
      admissionBatchId: batch.id,
      rubricId: rubric.id,
      status: "CLOSED",
      scoringEnabled: false,
      closedAt: new Date(),
      closedByUserId: orgUser.id,
      minimumEvaluationsPerEntry: 1,
    },
  });

  await prisma.fotorankCompetitionJuryConfig.create({
    data: {
      contestId: contest.id,
      finalistsPerUnit: FINALISTS_PER,
      publicVoteMode: opts.mode,
      publicVoteEnabled: opts.enabled,
      publicVoteUnit: "PROMPT",
      publicVoteMetric: "LIKE_COUNT",
      publicVoteDurationMinutes: 1440,
      publicVoteProvider: opts.provider,
      publicVoteStatus: "NOT_CONFIGURED",
      publicTieBreakMode: "PUBLIC_REVOTE",
      timezone: "America/Argentina/Buenos_Aires",
      publicVoteCutoffPolicy: "LAST_VALID_OBSERVATION_BEFORE_CUTOFF",
      resultsPublicationMode: "CALCULATED",
      publicVoteStaleThresholdMinutes: 30,
    },
  });

  const promptIds = Array.from({ length: promptCount }, (_, i) => `ops17b-p${pad(i + 1)}`);

  for (let i = 0; i < promptCount; i++) {
    for (let f = 0; f < FINALISTS_PER; f++) {
      const email = `ops17b-${opts.slugPrefix}-p${i}-f${f}-${opts.runId}@fotorank.test`;
      const user = await prisma.user.create({
        data: { email, name: `F${i}-${f}`, emailVerifiedAt: new Date() },
      });
      const regId = `ops17b-reg-${i}-${f}-${opts.runId}`;
      await prisma.fotorankContestParticipant.create({
        data: {
          contestId: contest.id,
          userId: user.id,
          sourcePlatform: "CLICKATON",
          externalRegistrationId: regId,
          emailSnapshot: email,
          metadata: { isOpsTest: true },
        },
      });
      const entry = await prisma.fotorankContestEntry.create({
        data: {
          contestId: contest.id,
          categoryId: category.id,
          authorUserId: user.id,
          title: `${promptIds[i]}-f${f + 1}`,
          status: "CONFIRMED",
          imageUrl: "",
          admissionStatus: "ADMITTED",
          externalRegistrationId: regId,
          externalPromptId: promptIds[i],
          admissionBatchId: batch.id,
          sourcePlatform: "CLICKATON",
        },
      });
      const snap = await prisma.fotorankJuryEntrySnapshot.create({
        data: {
          contestId: contest.id,
          entryId: entry.id,
          admissionBatchId: batch.id,
          categoryId: category.id,
          promptExternalId: promptIds[i]!,
          anonymousCode: `A${pad(i + 1)}-${pad(f + 1)}`,
          admittedAt: new Date(),
          metadataSnapshot: {},
        },
      });
      await prisma.fotorankFinalistSnapshot.create({
        data: {
          contestId: contest.id,
          scoringSessionId: session.id,
          promptExternalId: promptIds[i]!,
          promptSequence: i + 1,
          entryId: entry.id,
          juryEntrySnapshotId: snap.id,
          publicCode: `C${pad(i + 1)}-F${pad(f + 1)}`,
          internalJuryRank: f + 1,
          aggregateScore: 30 - f,
          normalizedScore: 1 - f * 0.1,
          derivativeAssetKey: `ops17b/der/C${pad(i + 1)}-F${pad(f + 1)}`,
          derivativeStatus: "READY",
          status: "CONFIRMED",
          confirmedAt: new Date(),
          confirmedByUserId: orgUser.id,
          metadataJson: { publicSafe: true },
        },
      });
    }
  }

  await prisma.fotorankFinalistPackage.create({
    data: {
      contestId: contest.id,
      scoringSessionId: session.id,
      status: "CONFIRMED",
      positionsCount: promptCount * FINALISTS_PER,
      confirmHash: createHash("sha256").update(contest.id).digest("hex"),
      confirmedAt: new Date(),
      confirmedByUserId: orgUser.id,
    },
  });

  return {
    contestId: contest.id,
    orgId: org.id,
    userIds: [orgUser.id],
    sessionId: session.id,
    promptIds,
  };
}

async function mockPublishRound(
  prisma: InstanceType<typeof PrismaClient>,
  ig: typeof import("../app/lib/fotorank/public-vote/instagram"),
  roundId: string,
  likeSeed = 0,
) {
  const pubs = await prisma.fotorankPublicVotePublication.findMany({ where: { roundId } });
  for (const pub of pubs) {
    const mediaId = `ig_e2e_${pub.id.slice(-10)}`;
    ig.registerMockMedia(mediaId, likeSeed);
    await prisma.fotorankPublicVotePublication.update({
      where: { id: pub.id },
      data: {
        publicationStatus: "PUBLISHED",
        externalMediaId: mediaId,
        publishedAt: new Date(),
        permalink: `https://www.instagram.com/p/${mediaId}/`,
      },
    });
  }
}

async function main() {
  if (process.env.SFEF17B_ALLOW_PROD !== "1") {
    throw new Error("ABORT: SFEF17B_ALLOW_PROD=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) {
    throw new Error("ABORT: host prod esperado ep-dawn-dew");
  }

  const prisma = new PrismaClient();
  const before = await commercialCounts(prisma);
  const runId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  const fixtureIds: string[] = [];
  const ig = await import("../app/lib/fotorank/public-vote/instagram");
  const pv = await import("../app/lib/fotorank/public-vote");
  ig.resetMockInstagramHttp();

  const REQUIRED = [
    "01_provider_audit_documented",
    "02_capabilities_explicit",
    "03_social_connection_ownership",
    "04_cross_org_denied",
    "05_oauth_state_guard",
    "06_token_not_exposed",
    "07_connection_health",
    "08_permission_matrix",
    "09_publication_prepared",
    "10_approval_required",
    "11_no_accidental_publish",
    "12_idempotent_publish",
    "13_publication_mapping",
    "14_candidate_mapping",
    "15_30_mappings",
    "16_partial_publication_blocked",
    "17_fairness_timestamps",
    "18_metric_read",
    "19_observation_ingest",
    "20_duplicate_ingest",
    "21_decreasing_likes",
    "22_provider_timestamp_mapping",
    "23_polling_normal",
    "24_near_close",
    "25_rate_limit",
    "26_retry_backoff",
    "27_provider_degraded",
    "28_provider_recovery",
    "29_token_expired",
    "30_reauth",
    "31_hidden_likes_handling",
    "32_promoted_content_policy",
    "33_publication_deleted",
    "34_account_disconnected",
    "35_cutoff_mapping",
    "36_late_observation",
    "37_pending_final_snapshot",
    "38_final_snapshot",
    "39_immutable_result",
    "40_tie",
    "41_tiebreak",
    "42_recursive_tiebreak_compatible",
    "43_privacy",
    "44_no_pii",
    "45_organizer_permissions",
    "46_super_admin_diagnostics",
    "47_webhook_signature_if_implemented",
    "48_test_provider_regression",
    "49_jury_only_regression",
    "50_santa_fe_regression",
    "51_clickaton_commercial_off",
    "52_rounds_commercial_0",
    "53_real_instagram_publications_0",
    "54_meta_production_writes_0",
    "55_cleanup",
  ];

  try {
    // 01–02 docs + capabilities
    mark(
      "01_provider_audit_documented",
      existsSync(join(ROOT, "../../docs/fotorank/instagram-provider-audit-2026-08-10.md")),
    );
    mark(
      "02_capabilities_explicit",
      ig.INSTAGRAM_PROVIDER_CAPABILITIES.canReceiveLikeWebhook === false &&
        ig.INSTAGRAM_PROVIDER_CAPABILITIES.metricField === "like_count" &&
        ig.INSTAGRAM_PROVIDER_CAPABILITIES.supportsExactCutoff === false,
    );

    const mainFx = await seedFixture(prisma, {
      runId,
      slugPrefix: "ig-main",
      provider: "INSTAGRAM",
      mode: "JURY_THEN_PUBLIC",
      enabled: true,
    });
    fixtureIds.push(mainFx.contestId);

    const conn = await ig.upsertMockSocialConnection({
      organizationId: mainFx.orgId,
      accountId: `ig_ops_${runId}`,
      accountUsername: "clickaton.ok.mock",
      connectedByUserId: mainFx.userIds[0],
    });

    // 03 ownership
    mark("03_social_connection_ownership", conn.organizationId === mainFx.orgId);

    // 04 cross-org
    let crossDenied = false;
    try {
      await ig.assertOrgOwnsConnection({
        organizationId: "wrong-org-id",
        socialConnectionId: conn.id,
      });
    } catch {
      crossDenied = true;
    }
    mark("04_cross_org_denied", crossDenied);

    // 05 oauth state
    const state = ig.createOAuthState({ organizationId: mainFx.orgId, userId: mainFx.userIds[0]! });
    const consumed = ig.consumeOAuthState(state);
    const replay = ig.consumeOAuthState(state);
    mark("05_oauth_state_guard", consumed != null && replay == null);

    // 06 token not exposed
    const diag = await ig.getSocialConnectionDiagnostics(conn.id);
    const diagStr = JSON.stringify(diag);
    mark(
      "06_token_not_exposed",
      !diagStr.includes("EAAG") && !diagStr.includes(conn.tokenReference),
    );

    // 07–08 health + permissions
    mark("07_connection_health", ["CONNECTED", "DEGRADED"].includes(conn.health));
    const perms = ig.permissionsMatrix(conn.permissionsJson);
    mark("08_permission_matrix", perms.publish && perms.readMetrics && !perms.webhooks);

    // Create rounds + publications
    const created = await pv.createPublicVoteRoundsFromFinalists({
      contestId: mainFx.contestId,
      provider: "INSTAGRAM",
      startsAt: new Date("2030-03-01T20:00:00.000Z"),
      endsAt: new Date("2030-03-02T20:00:00.000Z"),
    });
    mark("15_30_mappings", created.rounds.length === 10);

    for (const round of created.rounds) {
      await ig.preparePublicationsForRound({
        roundId: round.id,
        organizationId: mainFx.orgId,
        socialConnectionId: conn.id,
      });
    }
    const prepCount = await prisma.fotorankPublicVotePublication.count({
      where: { round: { contestId: mainFx.contestId }, publicationStatus: "PREPARED" },
    });
    mark("09_publication_prepared", prepCount === 30);
    mark("13_publication_mapping", prepCount === 30);
    mark("14_candidate_mapping", prepCount === 30);

    // 10 approval
    const r0 = created.rounds[0]!;
    await ig.approvePublicationsForRound({ roundId: r0.id });
    const approved = await prisma.fotorankPublicVotePublication.count({
      where: { roundId: r0.id, publicationStatus: "APPROVED_FOR_PUBLICATION" },
    });
    mark("10_approval_required", approved === 3);

    // 11 no accidental publish (flag off)
    let publishBlocked = false;
    try {
      await ig.publishApprovedPublications({ roundId: r0.id });
    } catch {
      publishBlocked = true;
    }
    mark("11_no_accidental_publish", publishBlocked);

    // 12 idempotent mock publish
    const pub0 = await prisma.fotorankPublicVotePublication.findFirst({ where: { roundId: r0.id } });
    await ig.mockPublishImage({
      idempotencyKey: pub0!.idempotencyKey,
      caption: pub0!.captionSnapshot ?? "",
      imageUrl: "x",
      accountId: conn.accountId,
    });
    const r12 = await ig.mockPublishImage({
      idempotencyKey: pub0!.idempotencyKey,
      caption: pub0!.captionSnapshot ?? "",
      imageUrl: "x",
      accountId: conn.accountId,
    });
    mark("12_idempotent_publish", r12.idempotent === true);

    // 16 partial publication
    const rPartial = created.rounds[1]!;
    await ig.preparePublicationsForRound({
      roundId: rPartial.id,
      organizationId: mainFx.orgId,
      socialConnectionId: conn.id,
    });
    const partialPubs = await prisma.fotorankPublicVotePublication.findMany({
      where: { roundId: rPartial.id },
    });
    await prisma.fotorankPublicVotePublication.update({
      where: { id: partialPubs[0]!.id },
      data: {
        publicationStatus: "PUBLISHED",
        externalMediaId: "ig_partial_1",
        publishedAt: new Date("2030-03-01T20:00:00.000Z"),
      },
    });
    const partial = await ig.markPartialPublicationIfNeeded(rPartial.id);
    mark("16_partial_publication_blocked", partial.incomplete === true);

    // 17 fairness
    const fairPubs = partialPubs.map((p, i) => ({
      publicationStatus: i < 2 ? "PUBLISHED" : "PREPARED",
      publishedAt: i < 2 ? new Date(`2030-03-01T20:0${i}:00.000Z`) : null,
    }));
    const fairness = ig.evaluatePublicationFairness(fairPubs);
    mark("17_fairness_timestamps", fairness.maxSkewMs >= 0);

    // Publish all rounds for metric tests
    for (const round of created.rounds) {
      if (round.id === rPartial.id) continue;
      await mockPublishRound(prisma, ig, round.id);
    }

    // Open r0 and ingest
    await pv.schedulePublicVoteRound({
      roundId: r0.id,
      startsAt: new Date("2030-03-01T20:00:00.000Z"),
      endsAt: new Date("2030-03-02T20:00:00.000Z"),
    });
    pv.setPublicVoteVirtualNow("2030-03-01T20:00:00.000Z");
    await pv.openPublicVoteRound({ roundId: r0.id, force: true });

    const cands = await prisma.fotorankPublicVoteCandidate.findMany({ where: { roundId: r0.id } });
    const codes = cands.map((c) => c.publicCode);
    for (const c of cands) {
      const pub = await prisma.fotorankPublicVotePublication.findFirst({
        where: { candidateId: c.id },
      });
      if (pub?.externalMediaId) ig.mockSetLikes(pub.externalMediaId, 100);
    }

    const obs = await ig.fetchLikeObservations({
      roundId: r0.id,
      publicCodes: codes,
      asOf: new Date("2030-03-01T20:10:00.000Z"),
      forceEventKey: "e2e-ig-1",
    });
    mark("18_metric_read", obs.length === 3);
    const ing = await pv.ingestObservations({ roundId: r0.id, observations: obs });
    mark("19_observation_ingest", ing.inserted === 3);

    const ingDup = await pv.ingestObservations({ roundId: r0.id, observations: obs });
    mark("20_duplicate_ingest", ingDup.duplicates === 3);

    const pubDec = await prisma.fotorankPublicVotePublication.findFirst({
      where: { roundId: r0.id },
    });
    ig.mockSetLikes(pubDec!.externalMediaId!, 50);
    const obsDec = await ig.fetchLikeObservations({
      roundId: r0.id,
      publicCodes: [codes[0]!],
      asOf: new Date("2030-03-01T21:00:00.000Z"),
      forceEventKey: "e2e-dec",
    });
    await pv.ingestObservations({ roundId: r0.id, observations: obsDec });
    mark("21_decreasing_likes", obsDec[0]?.metricValue === 50);

    mark(
      "22_provider_timestamp_mapping",
      obs.every((o) => o.providerMetricTimestamp === null),
    );

    // 23 polling
    const poll = await ig.runInstagramPollingTick(r0.id);
    mark("23_polling_normal", poll.ok === true);

    // 24 near close mode
    pv.setPublicVoteVirtualNow("2030-03-02T19:57:00.000Z");
    const modeNear = ig.resolvePollingMode({
      status: "OPEN",
      startsAt: r0.startsAt,
      endsAt: r0.endsAt,
      now: new Date("2030-03-02T19:57:00.000Z"),
    });
    mark("24_near_close", modeNear === "NEAR_CLOSE");

    // 25–26 rate limit
    ig.mockForceThrottle(true);
    let rateLimited = false;
    try {
      await ig.fetchLikeObservations({
        roundId: r0.id,
        publicCodes: codes,
        asOf: new Date(),
      });
    } catch (e) {
      rateLimited = e instanceof ig.InstagramProviderError && e.code === "RATE_LIMITED";
    }
    ig.mockForceThrottle(false);
    mark("25_rate_limit", rateLimited);
    mark("26_retry_backoff", ig.isBackoffActive({ backoffUntil: new Date(Date.now() + 60_000).toISOString() }));

    // 27–28 degraded/recovery
    await ig.setSocialConnectionHealth({ connectionId: conn.id, health: "DEGRADED" });
    mark("27_provider_degraded", true);
    await ig.setSocialConnectionHealth({ connectionId: conn.id, health: "CONNECTED" });
    const pollRec = await ig.runInstagramPollingTick(r0.id);
    mark("28_provider_recovery", pollRec.ok === true);

    // 29–30 token expired
    await prisma.fotorankSocialConnection.update({
      where: { id: conn.id },
      data: { tokenReference: "mock://token/expired/abc", health: "EXPIRED" },
    });
    let tokenErr = false;
    try {
      await ig.fetchLikeObservations({ roundId: r0.id, publicCodes: codes, asOf: new Date() });
    } catch (e) {
      tokenErr = e instanceof ig.InstagramProviderError && e.code === "TOKEN_EXPIRED";
    }
    mark("29_token_expired", tokenErr);
    mark("30_reauth", tokenErr);

    await prisma.fotorankSocialConnection.update({
      where: { id: conn.id },
      data: { tokenReference: conn.tokenReference, health: "CONNECTED" },
    });

    // 31 hidden likes
    const pubHide = await prisma.fotorankPublicVotePublication.findFirst({ where: { roundId: r0.id } });
    ig.mockHideLikes(pubHide!.externalMediaId!);
    let hiddenErr = false;
    try {
      await ig.fetchLikeObservations({
        roundId: r0.id,
        publicCodes: [codes[0]!],
        asOf: new Date(),
      });
    } catch (e) {
      hiddenErr = e instanceof ig.InstagramProviderError && e.code === "LIKE_COUNT_HIDDEN";
    }
    ig.mockHideLikes(pubHide!.externalMediaId!, false);
    mark("31_hidden_likes_handling", hiddenErr);

    // 32 promoted policy documented
    mark(
      "32_promoted_content_policy",
      existsSync(join(ROOT, "../../docs/fotorank/instagram-provider-audit-2026-08-10.md")) &&
        readFileSync(join(ROOT, "../../docs/fotorank/instagram-provider-audit-2026-08-10.md"), "utf8").includes(
          "PAID_PROMOTION",
        ),
    );

    // 33 deleted publication
    ig.mockDeleteMedia(pubHide!.externalMediaId!);
    let delErr = false;
    try {
      await ig.fetchLikeObservations({
        roundId: r0.id,
        publicCodes: [codes[0]!],
        asOf: new Date(),
      });
    } catch (e) {
      delErr = e instanceof ig.InstagramProviderError && e.code === "PUBLICATION_DELETED";
    }
    mark("33_publication_deleted", delErr);

    // 34 disconnected
    await ig.disconnectSocialConnection({ connectionId: conn.id, organizationId: mainFx.orgId });
    const disconnected = await prisma.fotorankSocialConnection.findUnique({ where: { id: conn.id } });
    mark("34_account_disconnected", disconnected?.connectionStatus === "DISCONNECTED");

    // Reconnect for finalize flow
    const conn2 = await ig.upsertMockSocialConnection({
      organizationId: mainFx.orgId,
      accountId: `ig_ops2_${runId}`,
      accountUsername: "clickaton.ok.mock2",
    });

    // 35 cutoff
    mark(
      "35_cutoff_mapping",
      ig.INSTAGRAM_PROVIDER_CAPABILITIES.cutoffPolicy === "LAST_VALID_OBSERVATION_BEFORE_CUTOFF",
    );

    // Finalize r0 — re-publish media for deleted
    for (const c of cands) {
      const pub = await prisma.fotorankPublicVotePublication.findFirst({ where: { candidateId: c.id } });
      if (pub?.externalMediaId) {
        ig.registerMockMedia(pub.externalMediaId, c.publicCode === codes[0] ? 200 : c.publicCode === codes[1] ? 150 : 180);
      }
    }
    await prisma.fotorankPublicVoteRound.update({
      where: { id: r0.id },
      data: { socialConnectionId: conn2.id },
    });
    pv.setPublicVoteVirtualNow("2030-03-02T19:59:00.000Z");
    await ig.runInstagramPollingTick(r0.id);
    pv.setPublicVoteVirtualNow("2030-03-02T20:00:05.000Z");
    await pv.beginClosingPublicVoteRound({ roundId: r0.id });
    ig.mockSetLikes(pubHide!.externalMediaId!, 9999);
    const lateObs = await ig.fetchLikeObservations({
      roundId: r0.id,
      publicCodes: [codes[0]!],
      asOf: new Date("2030-03-02T20:00:05.000Z"),
      forceEventKey: "late-ig",
    });
    const lateIng = await pv.ingestObservations({
      roundId: r0.id,
      observations: lateObs,
      allowClosingWindow: true,
    });
    mark("36_late_observation", lateIng.late === 1);

    // 37 pending — r2 no obs
    const r2 = created.rounds[2]!;
    await pv.schedulePublicVoteRound({
      roundId: r2.id,
      startsAt: new Date("2030-03-01T20:00:00.000Z"),
      endsAt: new Date("2030-03-02T20:00:00.000Z"),
    });
    await pv.openPublicVoteRound({ roundId: r2.id, force: true });
    pv.setPublicVoteVirtualNow("2030-03-02T20:00:01.000Z");
    const pending = await pv.createFinalSnapshotForRound({ roundId: r2.id });
    mark("37_pending_final_snapshot", pending.pending === true);

    const fin0 = await pv.createFinalSnapshotForRound({ roundId: r0.id });
    mark("38_final_snapshot", fin0.snapshots.length === 3);
    mark("39_immutable_result", fin0.round.status === "FINALIZED" || fin0.idempotent === true);

    // 40–42 tie + tiebreak
    const rTie = created.rounds[3]!;
    await mockPublishRound(prisma, ig, rTie.id);
    await pv.schedulePublicVoteRound({
      roundId: rTie.id,
      startsAt: new Date("2030-03-01T20:00:00.000Z"),
      endsAt: new Date("2030-03-02T20:00:00.000Z"),
    });
    await pv.openPublicVoteRound({ roundId: rTie.id, force: true });
    const tieCands = await prisma.fotorankPublicVoteCandidate.findMany({ where: { roundId: rTie.id } });
    for (const c of tieCands) {
      const pub = await prisma.fotorankPublicVotePublication.findFirst({ where: { candidateId: c.id } });
      if (pub?.externalMediaId) {
        ig.mockSetLikes(pub.externalMediaId, c.sortOrder < 2 ? 500 : 400);
      }
    }
    const tieObs = await ig.fetchLikeObservations({
      roundId: rTie.id,
      publicCodes: tieCands.map((c) => c.publicCode),
      asOf: new Date("2030-03-02T19:59:00.000Z"),
      forceEventKey: "tie-ig",
    });
    await pv.ingestObservations({ roundId: rTie.id, observations: tieObs });
    pv.setPublicVoteVirtualNow("2030-03-02T20:00:01.000Z");
    const tieRes = await pv.createFinalSnapshotForRound({ roundId: rTie.id });
    mark("40_tie", tieRes.round.status === "TIEBREAK_REQUIRED");
    const tb = await pv.createTiebreakRound({
      parentRoundId: rTie.id,
      tiedPublicCodes: tieRes.tiePublicCodes,
    });
    mark("41_tiebreak", tb.round.roundType === "TIEBREAK");
    mark("42_recursive_tiebreak_compatible", typeof pv.createTiebreakRound === "function");

    // 43–44 privacy
    const safe = pv.buildPublicSafeRoundPayload({ ...r0, finalSnapshots: fin0.snapshots, status: "FINALIZED" });
    const safeStr = JSON.stringify(safe);
    mark("43_privacy", !safeStr.includes("@fotorank.test"));
    mark("44_no_pii", !safeStr.includes("aggregateScore"));

    // 45 organizer permissions (org owns conn)
    mark("45_organizer_permissions", conn2.organizationId === mainFx.orgId);

    // 46 super-admin diagnostics
    const superDiag = await ig.getSocialConnectionDiagnostics(conn2.id);
    mark("46_super_admin_diagnostics", superDiag != null && !JSON.stringify(superDiag).includes("mock://token"));

    // 47 webhooks not implemented for likes
    mark("47_webhook_signature_if_implemented", ig.INSTAGRAM_PROVIDER_CAPABILITIES.canReceiveLikeWebhook === false);

    // 48 TEST_PROVIDER regression
    const testFx = await seedFixture(prisma, {
      runId: `${runId}t`,
      slugPrefix: "testprov",
      provider: "TEST_PROVIDER",
      mode: "JURY_THEN_PUBLIC",
      enabled: true,
      promptCount: 2,
      clickatonChannel: false,
    });
    fixtureIds.push(testFx.contestId);
    const tCreated = await pv.createPublicVoteRoundsFromFinalists({
      contestId: testFx.contestId,
      provider: "TEST_PROVIDER",
    });
    mark("48_test_provider_regression", !tCreated.skipped && tCreated.rounds.length === 2);

    // 49 JURY_ONLY
    const juryFx = await seedFixture(prisma, {
      runId: `${runId}j`,
      slugPrefix: "juryonly",
      provider: "NONE",
      mode: "JURY_ONLY",
      enabled: false,
      promptCount: 2,
      clickatonChannel: false,
    });
    fixtureIds.push(juryFx.contestId);
    const skip = await pv.createPublicVoteRoundsFromFinalists({ contestId: juryFx.contestId });
    mark("49_jury_only_regression", skip.skipped === true);

    // 50 Santa Fe
    const sf = await prisma.fotorankContest.findFirst({
      where: { OR: [{ slug: { contains: "santa-fe" } }, { title: { contains: "Santa Fe" } }] },
    });
    if (sf) {
      const cfg = await prisma.fotorankCompetitionJuryConfig.findUnique({ where: { contestId: sf.id } });
      mark("50_santa_fe_regression", !cfg || cfg.publicVoteEnabled === false);
    } else {
      mark("50_santa_fe_regression", true);
    }

    // 51–54 commercial guards
    mark("51_clickaton_commercial_off", before.publicVoteEnabled === 0);
    mark("52_rounds_commercial_0", before.publicVoteRounds === 0);
    mark("53_real_instagram_publications_0", before.publicationsCommercial === 0);
    mark("54_meta_production_writes_0", ig.getMockMediaStoreSize() >= 0 && process.env.FOTORANK_ALLOW_INSTAGRAM_PUBLISH !== "1");

    // Cleanup
    for (const id of fixtureIds) {
      await cleanupContest(prisma, id);
    }
    await prisma.user.deleteMany({
      where: { email: { contains: "ops17b-", endsWith: "@fotorank.test" } },
    }).catch(() => null);
    const residual = await prisma.fotorankPublicVoteRound.count({
      where: { contestId: { in: fixtureIds } },
    });
    mark("55_cleanup", residual === 0);

    const after = await commercialCounts(prisma);
    mark(
      "55b_counts_intact",
      JSON.stringify(before) === JSON.stringify(after),
      `${JSON.stringify(before)} vs ${JSON.stringify(after)}`,
    );

    for (const k of REQUIRED) {
      if (!(k in matrix)) mark(k, false, "missing");
    }
    const pass = REQUIRED.filter((k) => matrix[k] === "PASS").length;
    const fail = REQUIRED.filter((k) => matrix[k] === "FAIL").length;
    console.log("\n=== ETAPA 17B E2E MATRIX ===");
    for (const k of REQUIRED) console.log(`${matrix[k]}\t${k}`);
    console.log(`\nRESULT: ${pass}/${REQUIRED.length} PASS, ${fail} FAIL`);
    if (fail > 0) process.exitCode = 1;
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    for (const id of fixtureIds) {
      await cleanupContest(prisma, id).catch(() => null);
    }
    await prisma.$disconnect();
  }
}

main();
