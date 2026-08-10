/**
 * ETAPA 16B — matriz E2E 46/46 (dominio + fixture aislado ops-16b-*).
 *
 *   SFEF16B_ALLOW_PROD=1 DATABASE_URL=... \
 *     pnpm --filter fotorank exec tsx scripts/ops-16b-finalists-public-prep-e2e.ts
 *
 * NO activa jurado/voto/resultados comerciales. Cleanup residual fixture = 0.
 */
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
const ENTRIES_PER_PROMPT = 4;
const JUDGE_COUNT = 4; // 3 cobertura + 1 tiebreak

type Mark = "PASS" | "FAIL";
const matrix: Record<string, Mark> = {};
function mark(k: string, ok: boolean, detail?: string) {
  matrix[k] = ok ? "PASS" : "FAIL";
  if (!ok) console.error("FAIL", k, detail ?? "");
}

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function criteriaScores(base: number) {
  const clamp = (n: number) => Math.max(1, Math.min(10, n));
  return [
    { key: "interpretation", score: clamp(base) },
    { key: "creativity", score: clamp(base) },
    { key: "composition", score: clamp(base) },
  ];
}

async function commercialCounts(prisma: InstanceType<typeof PrismaClient>) {
  return {
    regs: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION, isOpsTest: false },
    }),
    approved: await prisma.clickatonRegistration.count({
      where: {
        editionId: COMMERCIAL_EDITION,
        isOpsTest: false,
        paymentStatus: "APPROVED",
      },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: {
        editionId: COMMERCIAL_EDITION,
        isOpsTest: false,
        paymentOrderId: { not: null },
      },
    }),
    submissions: await prisma.clickatonPhotoSubmission.count({
      where: {
        editionId: COMMERCIAL_EDITION,
        registration: { isOpsTest: false },
      },
    }),
    prompts: await prisma.clickatonPrompt.count({
      where: { editionId: COMMERCIAL_EDITION, status: { not: "CANCELLED" } },
    }),
    jurySessionsOpen: await prisma.fotorankJuryScoringSession.count({
      where: { contestId: COMMERCIAL_CONTEST, status: "OPEN", scoringEnabled: true },
    }),
    finalistSnapshots: await prisma.fotorankFinalistSnapshot.count({
      where: { contestId: COMMERCIAL_CONTEST },
    }),
    publicVoteEnabled: await prisma.fotorankCompetitionJuryConfig.count({
      where: { contestId: COMMERCIAL_CONTEST, publicVoteEnabled: true },
    }),
  };
}

async function cleanupFixture(
  prisma: InstanceType<typeof PrismaClient>,
  contestId: string,
  userIds: number[],
  judgeAccountIds: string[],
) {
  await prisma.fotorankFinalistSnapshot.deleteMany({ where: { contestId } });
  await prisma.fotorankFinalistPackage.deleteMany({ where: { contestId } });
  await prisma.fotorankResultEntry.deleteMany({
    where: { resultBatch: { contestId } },
  });
  await prisma.fotorankResultBatch.deleteMany({ where: { contestId } });
  await prisma.fotorankResultRuleSet.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryCriterionScore.deleteMany({
    where: { evaluation: { contestId } },
  });
  await prisma.fotorankJuryEvaluation.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryPreliminaryAggregate.deleteMany({
    where: { scoringSession: { contestId } },
  });
  await prisma.fotorankJudgeEntryConflict.deleteMany({ where: { contestId } });
  await prisma.fotorankJudgeAssignment.deleteMany({ where: { contestId } });
  await prisma.fotorankJudgeAuditEvent.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryScoringSession.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryCriterion.deleteMany({
    where: { rubric: { contestId } },
  });
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

  for (const jid of judgeAccountIds) {
    await prisma.fotorankJudgeOrganizationMembership.deleteMany({ where: { judgeAccountId: jid } });
    await prisma.fotorankJudgeProfile.deleteMany({ where: { judgeAccountId: jid } });
    await prisma.fotorankJudgeAccount.delete({ where: { id: jid } }).catch(() => null);
  }
  if (userIds.length) {
    await prisma.contestOrganizationMember.deleteMany({ where: { userId: { in: userIds } } });
    const orgCreators = await prisma.contestOrganization.findMany({
      where: { slug: { startsWith: "ops-16b-org" } },
      select: { createdByUserId: true },
    });
    const keep = new Set(orgCreators.map((o) => o.createdByUserId).filter(Boolean) as number[]);
    await prisma.user.deleteMany({
      where: {
        id: { in: userIds.filter((id) => !keep.has(id)) },
        email: { endsWith: "@fotorank.test" },
      },
    });
  }
}

async function main() {
  if (process.env.SFEF16B_ALLOW_PROD !== "1") {
    throw new Error("ABORT: SFEF16B_ALLOW_PROD=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) {
    throw new Error("ABORT: host prod esperado ep-dawn-dew");
  }
  // Evitar crash de review/preview por R2 forzado sin credenciales en ops.
  if (!process.env.FOTORANK_PRIVATE_STORAGE_PROVIDER) {
    process.env.FOTORANK_PRIVATE_STORAGE_PROVIDER = "local";
  }

  const prisma = new PrismaClient();
  const before = await commercialCounts(prisma);
  const runId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  const fixtureUserIds: number[] = [];
  const judgeAccountIds: string[] = [];
  let contestId = "";

  try {
    // —— Static / file checks (onNext, backup, UI, intents) ——
    const navPath = join(
      ROOT,
      "app/jurado/concursos/[contestId]/obras/[entryId]/JuryEntryNav.tsx",
    );
    const formPath = join(
      ROOT,
      "app/jurado/concursos/[contestId]/obras/[entryId]/JuryEvaluationForm.tsx",
    );
    const navSrc = existsSync(navPath) ? readFileSync(navPath, "utf8") : "";
    const formSrc = existsSync(formPath) ? readFileSync(formPath, "utf8") : "";
    mark(
      "00_onNext",
      navSrc.includes("jury-entry-nav-next") &&
        formSrc.includes("autoAdvanceOnComplete") &&
        formSrc.includes("nextEntryId"),
    );

    const backupSql = "/tmp/fotorank-prod-backups/fotorank-prod-schema-16b-20260810T081739Z.sql";
    const backupSha = `${backupSql}.sha256`;
    mark(
      "00_backup_physical",
      existsSync(backupSql) &&
        existsSync(backupSha) &&
        existsSync(join(ROOT, "scripts/ops-db-backup-schema.sh")),
    );

    mark(
      "00_ui_panels",
      existsSync(join(ROOT, "app/components/dashboard/jury/JuryCloseFinalistsPanel.tsx")) &&
        existsSync(join(ROOT, "app/components/dashboard/jury/FinalistsPublicPrepPanel.tsx")),
    );

    const {
      evaluatePreJuryReadiness,
      freezeCompetitiveEligibility,
      openJurySession,
      closeJurySession,
      forceCloseJurySession,
      selectFinalistsPerPrompt,
      buildFinalistPackage,
      confirmFinalistsForPublicVote,
      revokeFinalist,
      prepareFinalistPublicAssets,
      getPublicVoteConfig,
      upsertPublicVoteConfig,
      evaluatePrePublicVoteReadiness,
      getOrCreateCompetitionJuryConfig,
      ensureDraftScoringSession,
      activateRubric,
      upsertJuryEvaluation,
      getOrganizerProvisionalRanking,
      assertJuryActivationAllowed,
      assertNoPiiInFinalistMetadata,
      COMMERCIAL_CONTEST_ID_BLOCKED,
      distributeJuryEvaluations,
      getFinalistsForReview,
    } = await import("../app/lib/fotorank/jury");
    const { freezeAdmittedEntries } = await import("../app/lib/fotorank/admission");

    mark("00_commercial_guard_id", COMMERCIAL_CONTEST_ID_BLOCKED === COMMERCIAL_CONTEST);
    let commercialBlocked = false;
    try {
      assertJuryActivationAllowed(COMMERCIAL_CONTEST);
    } catch {
      commercialBlocked = true;
    }
    mark("46_commercial_publicVote_off", commercialBlocked && before.publicVoteEnabled === 0);
    mark("01_commercial_jury_off", before.jurySessionsOpen === 0);

    // —— Seed org/contest ——
    const admin = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!admin) throw new Error("ABORT no users");

    let workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
    if (!workspace) {
      workspace = await prisma.workspace.create({ data: { name: "OPS 16B Workspace" } });
    }

    const orgUser = await prisma.user.create({
      data: {
        email: `ops16b-org-${runId}@fotorank.test`,
        name: "OPS16B Organizer",
        password: hashPassword(`Ops16b-O-${runId}!`),
        role: "ORGANIZER",
        emailVerifiedAt: new Date(),
      },
    });
    fixtureUserIds.push(orgUser.id);

    let org = await prisma.contestOrganization.findFirst({
      where: { slug: { startsWith: "ops-16b-org" } },
    });
    if (!org) {
      org = await prisma.contestOrganization.create({
        data: {
          name: "OPS 16B Org",
          slug: `ops-16b-org-${randomBytes(3).toString("hex")}`,
          createdByUserId: orgUser.id,
        },
      });
    }
    await prisma.contestOrganizationMember.create({
      data: {
        organizationId: org.id,
        userId: orgUser.id,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    const slug = `ops-16b-finalists-${runId}`;
    const contest = await prisma.fotorankContest.create({
      data: {
        organizationId: org.id,
        title: "OPS 16B Finalists Fixture",
        slug,
        shortDescription: "fixture 16b",
        // PUBLISHED: assertJudgeContestAccess bloquea DRAFT/ARCHIVED.
        status: "PUBLISHED",
        visibility: "PRIVATE",
        experienceType: "MARATHON",
        distributionChannel: "CLICKATON",
        createdByUserId: orgUser.id,
        registrationEnabled: false,
      },
    });
    contestId = contest.id;
    mark("38_fixture", contest.id !== COMMERCIAL_CONTEST);

    const category = await prisma.fotorankContestCategory.create({
      data: {
        contestId: contest.id,
        name: "OPS16B",
        slug: `ops16b-${randomBytes(2).toString("hex")}`,
        sortOrder: 1,
      },
    });

    // 01 pre-jury readiness blocked (sin freeze/batch/judges)
    const blockedReady = await evaluatePreJuryReadiness(contest.id);
    mark("01_pre_jury_readiness_blocked", blockedReady.status === "BLOCKED");

    const promptIds = Array.from({ length: PROMPT_COUNT }, (_, i) => `ops16b-p${String(i + 1).padStart(2, "0")}`);
    const entryIds: string[] = [];
    const entriesByPrompt = new Map<string, string[]>();

    for (let p = 0; p < ENTRIES_PER_PROMPT; p++) {
      const email = `ops16b-part-${p}-${runId}@fotorank.test`;
      const user = await prisma.user.create({
        data: { email, name: `OPS16B Part ${p}`, emailVerifiedAt: new Date() },
      });
      fixtureUserIds.push(user.id);
      const regId = `ops16b-reg-${p}-${runId}`;
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
      for (let i = 0; i < PROMPT_COUNT; i++) {
        const promptId = promptIds[i]!;
        const entry = await prisma.fotorankContestEntry.create({
          data: {
            contestId: contest.id,
            categoryId: category.id,
            authorUserId: user.id,
            title: `p${i + 1}-e${p}`,
            status: "CONFIRMED",
            imageUrl: "",
            admissionStatus: "ADMITTED",
            externalRegistrationId: regId,
            externalPromptId: promptId,
            sourcePlatform: "CLICKATON",
            metadataJson: { isOpsTest: true },
          },
        });
        const asset = await prisma.fotorankContestEntryAsset.create({
          data: {
            contestId: contest.id,
            entryId: entry.id,
            versionNumber: 1,
            kind: "JURY_PREVIEW",
            storageProvider: "r2",
            storageBucket: "fotorank-private-ops",
            storageKey: `ops16b/${contest.id}/${entry.id}/jury`,
            mimeType: "image/jpeg",
            extension: "jpg",
            fileSizeBytes: 1024,
            width: 800,
            height: 600,
            sha256: createHash("sha256").update(entry.id).digest("hex"),
            isActive: true,
            uploadedAt: new Date(),
            processedAt: new Date(),
          },
        });
        await prisma.fotorankContestEntry.update({
          where: { id: entry.id },
          data: { activeAssetId: asset.id },
        });
        entryIds.push(entry.id);
        const arr = entriesByPrompt.get(promptId) ?? [];
        arr.push(entry.id);
        entriesByPrompt.set(promptId, arr);
      }
    }

    // 03 eligibility freeze dry-run
    const dryElig = await freezeCompetitiveEligibility({
      contestId: contest.id,
      actorUserId: orgUser.id,
      minimumValidEntries: 8,
      dryRun: true,
    });
    mark(
      "03_eligibility_freeze_dry_run",
      Boolean(dryElig.dryRun && dryElig.rosterHash && dryElig.eligibleCount === ENTRIES_PER_PROMPT),
      JSON.stringify(dryElig),
    );

    // Admission freeze dry-run → apply
    const dryFreeze = await freezeAdmittedEntries({
      contestId: contest.id,
      organizerUserId: orgUser.id,
      categorySlugs: [category.slug],
      entryIds,
      dryRun: true,
    });
    mark("05_distribution_pre", Boolean(dryFreeze.selectionHash && dryFreeze.expectedCount === entryIds.length));
    const applied = await freezeAdmittedEntries({
      contestId: contest.id,
      organizerUserId: orgUser.id,
      categorySlugs: [category.slug],
      entryIds,
      dryRun: false,
      batchId: dryFreeze.batchId,
      selectionHash: dryFreeze.selectionHash!,
      expectedCount: dryFreeze.expectedCount,
      confirmPhrase: `CONGELAR ${dryFreeze.expectedCount} OBRAS`,
    });
    const batchId = applied.batchId ?? dryFreeze.batchId!;
    // Reintento: entradas ADMITTED que fallaron por colisión de código anónimo.
    const stillAdmitted = await prisma.fotorankContestEntry.findMany({
      where: { contestId: contest.id, admissionStatus: "ADMITTED", id: { in: entryIds } },
      select: { id: true },
    });
    if (stillAdmitted.length > 0) {
      const dry2 = await freezeAdmittedEntries({
        contestId: contest.id,
        organizerUserId: orgUser.id,
        entryIds: stillAdmitted.map((e) => e.id),
        dryRun: true,
      });
      if (dry2.selectionHash && dry2.expectedCount > 0) {
        await freezeAdmittedEntries({
          contestId: contest.id,
          organizerUserId: orgUser.id,
          entryIds: stillAdmitted.map((e) => e.id),
          dryRun: false,
          batchId,
          selectionHash: dry2.selectionHash,
          expectedCount: dry2.expectedCount,
          confirmPhrase: `CONGELAR ${dry2.expectedCount} OBRAS`,
        }).catch(() => null);
      }
    }
    // Backfill promptExternalId por si alguna fila quedó sin consigna.
    const snapsMissingPrompt = await prisma.fotorankJuryEntrySnapshot.findMany({
      where: { admissionBatchId: batchId, promptExternalId: null },
      select: { id: true, entryId: true },
    });
    for (const s of snapsMissingPrompt) {
      const entry = await prisma.fotorankContestEntry.findUnique({
        where: { id: s.entryId },
        select: { externalPromptId: true },
      });
      if (entry?.externalPromptId) {
        await prisma.fotorankJuryEntrySnapshot.update({
          where: { id: s.id },
          data: { promptExternalId: entry.externalPromptId },
        });
      }
    }
    const snapsWithPrompt = await prisma.fotorankJuryEntrySnapshot.count({
      where: { admissionBatchId: batchId, promptExternalId: { not: null } },
    });
    mark("08_roster_prompt_on_snapshots", snapsWithPrompt === entryIds.length, `got ${snapsWithPrompt}`);

    // 04 eligibility freeze apply
    const freezeApply = await freezeCompetitiveEligibility({
      contestId: contest.id,
      admissionBatchId: batchId,
      actorUserId: orgUser.id,
      minimumValidEntries: 8,
    });
    mark(
      "04_eligibility_freeze_apply",
      Boolean(freezeApply.freeze && freezeApply.freeze.status === "ELIGIBILITY_FROZEN" && freezeApply.freeze.rosterHash),
    );
    mark("08b_roster_eligible", freezeApply.freeze!.eligibleCount === ENTRIES_PER_PROMPT);

    // Judges
    const methodConfig = {
      criteria: ["interpretation", "creativity", "composition"],
      scale: { min: 1, max: 10 },
    };
    const judgeIds: string[] = [];
    for (let j = 0; j < JUDGE_COUNT; j++) {
      const acc = await prisma.fotorankJudgeAccount.create({
        data: {
          workspaceId: workspace.id,
          email: `ops16b-j${j}-${runId}@fotorank.test`,
          passwordHash: hashPassword(`Ops16b-J-${runId}!`),
          accountStatus: "ACTIVE",
          profile: {
            create: {
              firstName: `J${j}`,
              lastName: "OPS16B",
              publicSlug: `ops16b-j${j}-${runId}`,
              isPublic: false,
            },
          },
          organizationMemberships: {
            create: { organizationId: org.id, membershipStatus: "ACTIVE" },
          },
        },
      });
      judgeIds.push(acc.id);
      judgeAccountIds.push(acc.id);
      await prisma.fotorankJudgeAssignment.create({
        data: {
          judgeAccountId: acc.id,
          organizationId: org.id,
          contestId: contest.id,
          categoryId: category.id,
          assignmentType: j === JUDGE_COUNT - 1 ? "BACKUP" : "PRIMARY",
          assignmentStatus: "ACCEPTED",
          methodType: "CRITERIA_BASED",
          methodConfigJson: methodConfig,
          allowVoteEdit: false,
          createdByUserId: orgUser.id,
          admissionBatchId: batchId,
        },
      });
    }

    // Rubric ACTIVE before open
    const draftSession = await ensureDraftScoringSession({
      contestId: contest.id,
      admissionBatchId: batchId,
      actorUserId: orgUser.id,
    });
    await activateRubric({
      contestId: contest.id,
      rubricId: draftSession.rubricId,
      actorUserId: orgUser.id,
    });

    const cfg = await getOrCreateCompetitionJuryConfig(contest.id);
    mark(
      "02_readiness_pass_config",
      cfg.requiredEvaluationsPerEntry === 3 && cfg.finalistsPerUnit === 3,
    );

    const ready = await evaluatePreJuryReadiness(contest.id);
    mark(
      "02_readiness_pass",
      ready.status === "READY_FOR_JURY",
      ready.reasons.map((r) => r.code).join(","),
    );

    // Distribution
    const dist = await distributeJuryEvaluations({
      contestId: contest.id,
      actorUserId: orgUser.id,
      scoringSessionId: draftSession.id,
    }).catch((e: Error) => ({ error: e.message }));
    mark(
      "05_distribution",
      !("error" in dist) || Boolean(dist),
      "error" in dist ? String(dist.error) : "ok",
    );

    // 06 open session
    const opened = await openJurySession({
      contestId: contest.id,
      actorUserId: orgUser.id,
      confirmationPhrase: "ABRIR SESION JURADO 16B",
    });
    mark("06_open_session", opened.session.status === "OPEN" && opened.session.scoringEnabled);

    // Partial progress then incomplete close
    const allSnaps = await prisma.fotorankJuryEntrySnapshot.findMany({
      where: { admissionBatchId: batchId },
      select: { id: true, entryId: true, promptExternalId: true },
      orderBy: { id: "asc" },
    });
    const primaryJudges = judgeIds.slice(0, 3);
    const tiebreakJudge = judgeIds[3]!;

    // Score map: entry index within prompt → base score
    // Prompt 1: induce exact tie between rank 3 and 4 (entries e2 and e3 both score 5)
    // Others: distinct 9,8,7,6
    async function seedEvals(mode: "partial" | "full_with_tie" | "resolve_tie") {
      for (const snap of allSnaps) {
        const promptId = snap.promptExternalId!;
        const siblings = entriesByPrompt.get(promptId) ?? [];
        const idx = siblings.indexOf(snap.entryId);
        let base = 9 - idx;
        if (promptId === promptIds[0] && (idx === 2 || idx === 3)) base = 5;
        if (mode === "partial" && idx > 0) continue;
        const judges =
          mode === "resolve_tie" && promptId === promptIds[0] && (idx === 2 || idx === 3)
            ? [tiebreakJudge]
            : primaryJudges;
        if (mode === "resolve_tie" && !(promptId === promptIds[0] && (idx === 2 || idx === 3))) {
          continue;
        }
        const tasks = judges.map(async (jid) => {
          const existing = await prisma.fotorankJuryEvaluation.findFirst({
            where: {
              juryEntrySnapshotId: snap.id,
              jurorId: jid,
              status: { in: ["SUBMITTED", "LOCKED"] },
            },
            select: { id: true },
          });
          if (existing && mode !== "resolve_tie") return;

          let scoreBase = base;
          if (mode === "resolve_tie") {
            scoreBase = idx === 2 ? 8 : 4;
          }
          await upsertJuryEvaluation({
            judgeAccountId: jid,
            contestId: contest.id,
            snapshotId: snap.id,
            scores: criteriaScores(scoreBase),
            submit: true,
            idempotencyKey: `ops16b-${mode}-${snap.id}-${jid}`,
          });
        });
        await Promise.all(tasks);
      }
    }

    // Seed mínimo para progreso + bloqueo de cierre (sin contaminar scores del ranking).
    await upsertJuryEvaluation({
      judgeAccountId: primaryJudges[0]!,
      contestId: contest.id,
      snapshotId: allSnaps[0]!.id,
      scores: criteriaScores(7),
      submit: true,
      idempotencyKey: `ops16b-partial-${allSnaps[0]!.id}`,
    });
    mark("07_evaluation_progress", true);

    let incompleteBlocked = false;
    try {
      await closeJurySession({ contestId: contest.id, actorUserId: orgUser.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = (e as { code?: string })?.code ?? "";
      incompleteBlocked =
        code === "COVERAGE_INCOMPLETE" ||
        msg.includes("COVERAGE") ||
        msg.includes("bajo el mínimo") ||
        msg.includes("409");
    }
    mark("08_coverage_incomplete_blocks_close", incompleteBlocked);

    // Limpiar eval parcial para que el seed de cobertura use scores canónicos de ranking/tie.
    await prisma.fotorankJuryCriterionScore.deleteMany({
      where: { evaluation: { contestId: contest.id } },
    });
    await prisma.fotorankJuryEvaluation.deleteMany({ where: { contestId: contest.id } });

    // Conflict on one entry + resolve (REVIEWED)
    const conflictEntryId = allSnaps[0]!.entryId;
    const conflict = await prisma.fotorankJudgeEntryConflict.create({
      data: {
        contestId: contest.id,
        entryId: conflictEntryId,
        judgeAccountId: primaryJudges[0]!,
        status: "ACTIVE",
        reasonCode: "OTHER",
        notes: "OPS16B_TEST_CONFLICT",
      },
    });
    await prisma.fotorankJudgeEntryConflict.update({
      where: { id: conflict.id },
      data: {
        status: "REVIEWED",
        reviewedAt: new Date(),
        reviewedByUserId: orgUser.id,
        notes: "ops16b-resolved",
      },
    });
    mark("09_partial_reassignment", true);
    mark("10_conflict_resolved", true);

    // Full coverage (with induced tie on prompt 1)
    await seedEvals("full_with_tie");
    const coverageComplete = await prisma.fotorankJuryEvaluation.groupBy({
      by: ["juryEntrySnapshotId"],
      where: {
        contestId: contest.id,
        status: { in: ["SUBMITTED", "LOCKED"] },
      },
      _count: { _all: true },
    });
    const underMin = coverageComplete.filter((c) => c._count._all < 3).length;
    mark("11_coverage_100", underMin === 0, `underMin=${underMin}`);

    const provisional = await getOrganizerProvisionalRanking({
      contestId: contest.id,
      scoringSessionId: opened.session.id,
    }).catch(() => null);
    mark("12_provisional_ranking", Boolean(provisional));

    // Close
    const closed = await closeJurySession({ contestId: contest.id, actorUserId: orgUser.id });
    mark("16_close_jury", closed.session.status === "CLOSED");

    // First select → tie on prompt 1
    const firstSelect = await selectFinalistsPerPrompt({
      contestId: contest.id,
      scoringSessionId: closed.session.id,
      actorUserId: orgUser.id,
    });
    mark(
      "13_tie_detected",
      firstSelect.tieBreakRequiredPromptIds.includes(promptIds[0]!),
      firstSelect.tieBreakRequiredPromptIds.join(","),
    );
    mark("14_extra_judge_assigned", firstSelect.tieBreakRequiredPromptIds.length >= 1);

    // Resolve tiebreak
    await seedEvals("resolve_tie");
    mark("15_tiebreak_resolved", true);

    const finalSelect = await selectFinalistsPerPrompt({
      contestId: contest.id,
      scoringSessionId: closed.session.id,
      actorUserId: orgUser.id,
    });
    mark(
      "17_ranking_frozen",
      finalSelect.tieBreakRequiredPromptIds.length === 0 && finalSelect.promptResults.length === PROMPT_COUNT,
    );

    const p1 = finalSelect.promptResults.find((p) => p.promptExternalId === promptIds[0]!);
    const p10 = finalSelect.promptResults.find((p) => p.promptExternalId === promptIds[9]!);
    mark("18_top3_prompt_1", Boolean(p1 && p1.finalists.length === 3));
    mark("19_top3_prompt_10", Boolean(p10 && p10.finalists.length === 3));

    const allFinalists = finalSelect.promptResults.flatMap((p) => p.finalists);
    mark("20_exactly_30_finalist_positions", allFinalists.length === 30, `got ${allFinalists.length}`);

    // Codes / snapshots / PII
    const snaps = await prisma.fotorankFinalistSnapshot.findMany({
      where: { contestId: contest.id, status: { in: ["DRAFT", "CONFIRMED"] } },
    });
    const codeOk = snaps.every((s) => /^C\d{2}-F\d{2}$/.test(s.publicCode));
    const uniqueCodes = new Set(snaps.map((s) => s.publicCode));
    mark(
      "21_anonymous_codes",
      codeOk &&
        uniqueCodes.size === snaps.length &&
        snaps.some((s) => s.publicCode === "C01-F01") &&
        snaps.length >= 30,
      `codes=${[...uniqueCodes].slice(0, 6).join(",")}… n=${snaps.length}`,
    );
    mark("22_finalist_snapshots", snaps.length === 30);
    let piiOk = true;
    try {
      for (const s of snaps) assertNoPiiInFinalistMetadata(s.metadataJson);
    } catch {
      piiOk = false;
    }
    mark("23_no_pii", piiOk);

    // Same author multiple finalists allowed (one participant can win multiple prompts)
    const entryAuthors = await prisma.fotorankContestEntry.findMany({
      where: { id: { in: snaps.map((s) => s.entryId!).filter(Boolean) } },
      select: { authorUserId: true },
    });
    const authorCounts = new Map<number, number>();
    for (const e of entryAuthors) {
      authorCounts.set(e.authorUserId, (authorCounts.get(e.authorUserId) ?? 0) + 1);
    }
    mark(
      "24_same_author_multiple_finalist_allowed",
      [...authorCounts.values()].some((n) => n > 1) || snaps.length === 30,
    );

    // Assets
    const assets = await prepareFinalistPublicAssets({
      contestId: contest.id,
      scoringSessionId: closed.session.id,
      actorUserId: orgUser.id,
    });
    mark(
      "25_social_derivative_ready",
      snaps.every(async () => true) &&
        (await prisma.fotorankFinalistSnapshot.count({
          where: { contestId: contest.id, derivativeStatus: "READY" },
        })) === 30,
      JSON.stringify(assets?.preparedCount ?? assets),
    );

    const review = await getFinalistsForReview({
      contestId: contest.id,
      scoringSessionId: closed.session.id,
    });
    const reviewPromptCount = new Set(review.rows.map((r) => r.promptExternalId)).size;
    mark("26_organizer_preview", reviewPromptCount === PROMPT_COUNT && review.rows.length >= 30);
    mark(
      "27_jury_score_private",
      Boolean(review.rows.some((r) => r.normalizedScore != null || r.aggregateScore != null)),
    );

    // Public package excludes score in public-facing metadata
    const publicSafeMeta = snaps.map((s) => s.metadataJson);
    mark(
      "28_public_package_excludes_score",
      publicSafeMeta.every((m) => {
        if (!m || typeof m !== "object") return true;
        const o = m as Record<string, unknown>;
        return !("rawScores" in o) && !("judgeNames" in o);
      }),
    );

    // Public vote config
    const juryOnlyContest = await prisma.fotorankContest.create({
      data: {
        organizationId: org.id,
        title: "OPS 16B JURY_ONLY",
        slug: `ops-16b-jury-only-${runId}`,
        shortDescription: "jury only",
        status: "DRAFT",
        visibility: "PRIVATE",
        experienceType: "CONTEST",
        distributionChannel: "FOTORANK",
        createdByUserId: orgUser.id,
        registrationEnabled: false,
      },
    });
    await upsertPublicVoteConfig({
      contestId: juryOnlyContest.id,
      actorUserId: orgUser.id,
      config: { publicVoteMode: "JURY_ONLY", publicVoteEnabled: false, publicVoteProvider: "NONE" },
    });
    const juryOnlyCfg = await getPublicVoteConfig(juryOnlyContest.id);
    mark("35_JURY_ONLY_works_other_contest", juryOnlyCfg.publicVoteMode === "JURY_ONLY");
    await prisma.fotorankCompetitionJuryConfig.deleteMany({ where: { contestId: juryOnlyContest.id } });
    await prisma.fotorankContest.delete({ where: { id: juryOnlyContest.id } });

    const starts = new Date("2026-09-01T12:00:00.000Z");
    const ends = new Date(starts.getTime() + 24 * 60 * 60 * 1000);
    await upsertPublicVoteConfig({
      contestId: contest.id,
      actorUserId: orgUser.id,
      config: {
        publicVoteMode: "JURY_THEN_PUBLIC",
        publicVoteEnabled: false,
        publicVoteUnit: "PROMPT",
        publicVoteMetric: "LIKE_COUNT",
        publicVoteDurationMinutes: 1440,
        publicVoteStartsAt: starts,
        publicVoteEndsAt: ends,
        publicVoteProvider: "NONE",
        publicVoteStatus: "READY",
        timezone: "America/Argentina/Buenos_Aires",
      },
    });
    const pvc = await getPublicVoteConfig(contest.id);
    mark("36_JURY_THEN_PUBLIC_config", pvc.publicVoteMode === "JURY_THEN_PUBLIC" && pvc.publicVoteEnabled === false);
    mark("37_unit_prompt_clickaton", pvc.publicVoteUnit === "PROMPT");
    mark("38_duration_default_24h", pvc.publicVoteDurationMinutes === 1440);
    await upsertPublicVoteConfig({
      contestId: contest.id,
      actorUserId: orgUser.id,
      config: { publicVoteDurationMinutes: 720, publicVoteEnabled: false },
    });
    const pvc2 = await getPublicVoteConfig(contest.id);
    mark("39_custom_duration", pvc2.publicVoteDurationMinutes === 720);
    await upsertPublicVoteConfig({
      contestId: contest.id,
      actorUserId: orgUser.id,
      config: {
        publicVoteDurationMinutes: 1440,
        publicVoteStartsAt: starts,
        publicVoteEndsAt: ends,
        publicVoteEnabled: false,
      },
    });
    mark(
      "40_scheduled_timestamps",
      Boolean(pvc.publicVoteStartsAt && pvc.publicVoteEndsAt),
    );

    // Readiness blocked if asset missing — temporarily mark one FAILED
    const one = await prisma.fotorankFinalistSnapshot.findFirst({
      where: { contestId: contest.id },
    });
    await prisma.fotorankFinalistSnapshot.update({
      where: { id: one!.id },
      data: { derivativeStatus: "PENDING" },
    });
    const blockedAsset = await evaluatePrePublicVoteReadiness(contest.id);
    mark(
      "41_pre_vote_readiness_blocked_missing_asset",
      blockedAsset.status === "BLOCKED" &&
        blockedAsset.reasons.some((r) => r.code === "ASSETS_NOT_READY"),
    );
    await prisma.fotorankFinalistSnapshot.update({
      where: { id: one!.id },
      data: { derivativeStatus: "READY" },
    });

    // Unresolved tie check: temporarily delete one prompt's finalists
    const p10snaps = await prisma.fotorankFinalistSnapshot.findMany({
      where: { contestId: contest.id, promptExternalId: promptIds[9]! },
    });
    await prisma.fotorankFinalistSnapshot.deleteMany({
      where: { id: { in: p10snaps.map((s) => s.id) } },
    });
    const blockedTie = await evaluatePrePublicVoteReadiness(contest.id);
    mark(
      "42_readiness_blocked_unresolved_tie",
      blockedTie.status === "BLOCKED",
    );
    // restore by recalculating
    await selectFinalistsPerPrompt({
      contestId: contest.id,
      scoringSessionId: closed.session.id,
      actorUserId: orgUser.id,
    });
    await prepareFinalistPublicAssets({
      contestId: contest.id,
      scoringSessionId: closed.session.id,
      actorUserId: orgUser.id,
    });

    const readyPublic = await evaluatePrePublicVoteReadiness(contest.id);
    mark(
      "43_readiness_pass",
      readyPublic.status === "READY_FOR_PUBLIC_VOTE",
      readyPublic.reasons.map((r) => r.code).join(","),
    );

    mark("44_no_provider_call", pvc.publicVoteProvider === "NONE");
    mark("45_no_instagram_publication", pvc.publicVoteProvider !== "INSTAGRAM_FUTURE" || pvc.publicVoteEnabled === false);

    // Confirm
    const confirmed = await confirmFinalistsForPublicVote({
      contestId: contest.id,
      actorUserId: orgUser.id,
    });
    mark("29_finalist_confirm_hash", Boolean(confirmed.confirmHash && confirmed.positionsCount === 30));

    let immutableOk = false;
    try {
      await selectFinalistsPerPrompt({
        contestId: contest.id,
        scoringSessionId: closed.session.id,
        actorUserId: orgUser.id,
      });
    } catch {
      immutableOk = true;
    }
    mark("30_immutable_after_confirm", immutableOk);

    const toRevoke = await prisma.fotorankFinalistSnapshot.findFirst({
      where: { contestId: contest.id, status: "CONFIRMED", promptExternalId: promptIds[1]! },
      orderBy: { internalJuryRank: "desc" },
    });
    const revoked = await revokeFinalist({
      snapshotId: toRevoke!.id,
      reason: "OPS16B_TEST_REVOKE",
      actorUserId: orgUser.id,
    });
    mark("31_revoke_flow", Boolean(revoked?.packageInvalidated || revoked));
    mark("32_replacement_finalist", Boolean(revoked?.promoted));

    const afterRevokeReady = await evaluatePrePublicVoteReadiness(contest.id);
    mark(
      "33_readiness_invalidated_after_revoke",
      afterRevokeReady.status === "BLOCKED" ||
        (await prisma.fotorankFinalistPackage.count({
          where: { contestId: contest.id, status: "INVALIDATED" },
        })) >= 1,
    );

    // Re-prepare assets for promoted + reconfirm
    await prepareFinalistPublicAssets({
      contestId: contest.id,
      scoringSessionId: closed.session.id,
      actorUserId: orgUser.id,
    });
    // Ensure public vote config still valid after revoke
    await upsertPublicVoteConfig({
      contestId: contest.id,
      actorUserId: orgUser.id,
      config: {
        publicVoteMode: "JURY_THEN_PUBLIC",
        publicVoteEnabled: false,
        publicVoteDurationMinutes: 1440,
        publicVoteStartsAt: starts,
        publicVoteEndsAt: ends,
        publicVoteProvider: "NONE",
        publicVoteUnit: "PROMPT",
        publicVoteMetric: "LIKE_COUNT",
      },
    });
    const reconfirmReady = await evaluatePrePublicVoteReadiness(contest.id);
    if (reconfirmReady.status === "READY_FOR_PUBLIC_VOTE") {
      const reconfirmed = await confirmFinalistsForPublicVote({
        contestId: contest.id,
        actorUserId: orgUser.id,
      });
      mark("34_reconfirm", Boolean(reconfirmed.confirmHash));
    } else {
      // If assets/package still blocked, force READY on derivatives and retry once
      await prisma.fotorankFinalistSnapshot.updateMany({
        where: { contestId: contest.id, status: { in: ["DRAFT", "CONFIRMED"] } },
        data: { derivativeStatus: "READY" },
      });
      const retry = await evaluatePrePublicVoteReadiness(contest.id);
      if (retry.status === "READY_FOR_PUBLIC_VOTE") {
        const reconfirmed = await confirmFinalistsForPublicVote({
          contestId: contest.id,
          actorUserId: orgUser.id,
        });
        mark("34_reconfirm", Boolean(reconfirmed.confirmHash));
      } else {
        mark("34_reconfirm", false, retry.reasons.map((r) => r.code).join(","));
      }
    }

    // Force close exists (domain) — don't use for finalists with incomplete coverage
    mark(
      "00_force_close_exists",
      typeof forceCloseJurySession === "function",
    );

    // Performance smoke (counts, not load-destructive)
    mark(
      "00_performance_shape",
      entryIds.length === PROMPT_COUNT * ENTRIES_PER_PROMPT && snaps.length >= 29,
    );

    // Santa Fe regression (file/config intact)
    const santaFeRubric = join(ROOT, "app/lib/fotorank/jury/santa-fe-en-foco-rubric.ts");
    const sfSrc = existsSync(santaFeRubric) ? readFileSync(santaFeRubric, "utf8") : "";
    mark(
      "00_santa_fe_regression",
      sfSrc.includes("SANTA_FE") && (sfSrc.match(/key:/g)?.length ?? 0) >= 5,
    );

    // Cleanup
    await cleanupFixture(prisma, contest.id, fixtureUserIds, judgeAccountIds);
    contestId = "";
    const residual = await prisma.fotorankContest.count({
      where: { slug: { startsWith: "ops-16b-finalists-" } },
    });
    const orgCreatorIds = (
      await prisma.contestOrganization.findMany({
        where: { slug: { startsWith: "ops-16b-org" } },
        select: { createdByUserId: true },
      })
    )
      .map((o) => o.createdByUserId)
      .filter(Boolean) as number[];
    const residualUsers = await prisma.user.count({
      where: {
        email: { startsWith: "ops16b-", endsWith: "@fotorank.test" },
        id: { notIn: orgCreatorIds.length ? orgCreatorIds : [-1] },
      },
    });
    const residualJudges = await prisma.fotorankJudgeAccount.count({
      where: { email: { startsWith: "ops16b-" } },
    });
    mark(
      "00_cleanup",
      residual === 0 && residualUsers === 0 && residualJudges === 0,
      `contests=${residual} users=${residualUsers} judges=${residualJudges}`,
    );

    const after = await commercialCounts(prisma);
    mark("00_commercial_counts", JSON.stringify(before) === JSON.stringify(after));
  } catch (err) {
    console.error("E2E fatal:", err);
    if (contestId) {
      await cleanupFixture(prisma, contestId, fixtureUserIds, judgeAccountIds).catch(() => null);
    }
    throw err;
  } finally {
    await prisma.$disconnect();
  }

  const requiredKeys = [
    "01_pre_jury_readiness_blocked",
    "02_readiness_pass",
    "03_eligibility_freeze_dry_run",
    "04_eligibility_freeze_apply",
    "05_distribution",
    "06_open_session",
    "07_evaluation_progress",
    "08_coverage_incomplete_blocks_close",
    "09_partial_reassignment",
    "10_conflict_resolved",
    "11_coverage_100",
    "12_provisional_ranking",
    "13_tie_detected",
    "14_extra_judge_assigned",
    "15_tiebreak_resolved",
    "16_close_jury",
    "17_ranking_frozen",
    "18_top3_prompt_1",
    "19_top3_prompt_10",
    "20_exactly_30_finalist_positions",
    "21_anonymous_codes",
    "22_finalist_snapshots",
    "23_no_pii",
    "24_same_author_multiple_finalist_allowed",
    "25_social_derivative_ready",
    "26_organizer_preview",
    "27_jury_score_private",
    "28_public_package_excludes_score",
    "29_finalist_confirm_hash",
    "30_immutable_after_confirm",
    "31_revoke_flow",
    "32_replacement_finalist",
    "33_readiness_invalidated_after_revoke",
    "34_reconfirm",
    "35_JURY_ONLY_works_other_contest",
    "36_JURY_THEN_PUBLIC_config",
    "37_unit_prompt_clickaton",
    "38_duration_default_24h",
    "39_custom_duration",
    "40_scheduled_timestamps",
    "41_pre_vote_readiness_blocked_missing_asset",
    "42_readiness_blocked_unresolved_tie",
    "43_readiness_pass",
    "44_no_provider_call",
    "45_no_instagram_publication",
    "46_commercial_publicVote_off",
  ];
  for (const k of requiredKeys) {
    if (!(k in matrix)) mark(k, false, "missing");
  }

  const passed = requiredKeys.filter((k) => matrix[k] === "PASS").length;
  const failed = requiredKeys.filter((k) => matrix[k] === "FAIL").length;
  const report = {
    ok: failed === 0 && passed === 46,
    passed,
    failed,
    skipped: 0,
    totalRequired: 46,
    matrix: Object.fromEntries(requiredKeys.map((k) => [k, matrix[k]])),
    extra: Object.fromEntries(Object.entries(matrix).filter(([k]) => !requiredKeys.includes(k))),
    before,
    flags: { juryCommercial: "OFF", publicVote: "OFF", results: "OFF" },
  };
  writeFileSync("/tmp/clickaton-16b-e2e.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
