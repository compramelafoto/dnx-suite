/**
 * Fixtures ETAPA 07B — invitación formal + ronda OPEN (sin evals previas).
 * Creds → /tmp/sfef-07b-creds.env (chmod 600). No email real.
 */
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import {
  activateRubric,
  ensureDraftScoringSession,
  openScoringSession,
  closeScoringSession,
} from "../app/lib/fotorank/jury";
import { freezeAdmittedEntries } from "../app/lib/fotorank/admission";
import { SANTA_FE_EN_FOCO_JURY_CRITERIA } from "../app/lib/fotorank/jury/santa-fe-en-foco-rubric";
import { buildJudgeInvitationRegistrationUrl } from "../app/lib/fotorank/judges/invitationLinks";
import { enqueueJuryNotificationIntent } from "../app/lib/fotorank/jury/notification-intents";

const KEY_LEN = 64;
const JUDGE_PASSWORD = `Sfef07b-J-${randomBytes(3).toString("hex")}!`;
const ORG_PASSWORD = `Sfef07b-O-${randomBytes(3).toString("hex")}!`;

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

async function main() {
  assertStaging();
  const runId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: "santa-fe-en-foco" },
    include: { categories: { where: { status: "ACTIVE" } } },
  });
  if (!contest) throw new Error("contest missing");
  const amateur = contest.categories.find((c) => c.slug === "fotografo-amateur");
  if (!amateur) throw new Error("amateur missing");

  const rulesVersion = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: contest.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!rulesVersion) throw new Error("rulesVersion missing");

  let workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!workspace) {
    workspace = await prisma.workspace.create({ data: { name: "SFEF07B Workspace" } });
  }

  // Cerrar sesiones OPEN previas
  const openSessions = await prisma.fotorankJuryScoringSession.findMany({
    where: { contestId: contest.id, status: "OPEN" },
    select: { id: true },
  });
  const orgEmail = `sfef07b-org-${runId}@fotorank.test`;
  const orgUser = await prisma.user.create({
    data: {
      email: orgEmail,
      name: "SFEF07B Organizer",
      password: hashPassword(ORG_PASSWORD),
      role: "ORGANIZER",
      emailVerifiedAt: new Date(),
      province: "Santa Fe",
      country: "Argentina",
    },
  });
  await prisma.contestOrganizationMember.create({
    data: {
      organizationId: contest.organizationId,
      userId: orgUser.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  // registerJudgeFromInvitation resuelve workspace vía Membership de un miembro ACTIVE de la org.
  await prisma.membership.upsert({
    where: {
      userId_workspaceId: { userId: orgUser.id, workspaceId: workspace.id },
    },
    create: {
      userId: orgUser.id,
      workspaceId: workspace.id,
      role: "ADMIN",
    },
    update: {},
  });

  for (const s of openSessions) {
    await closeScoringSession({
      contestId: contest.id,
      sessionId: s.id,
      actorUserId: orgUser.id,
      force: true,
      reason: "sfef07b-isolate",
    });
  }

  const entryIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const u = await prisma.user.create({
      data: {
        email: `sfef07b-part-${i}-${runId}@fotorank.test`,
        name: `SFEF07B Part ${i}`,
        password: hashPassword(ORG_PASSWORD),
        emailVerifiedAt: new Date(),
        province: "Córdoba",
        country: "Argentina",
      },
    });
    const reg = await prisma.fotorankContestRegistration.create({
      data: {
        contestId: contest.id,
        categoryId: amateur.id,
        participantUserId: u.id,
        status: "CONFIRMED",
        paymentStatus: "NOT_REQUIRED",
        paymentModeSnapshot: "FREE",
        registrationNumber: `SFEF07B-${runId}-${i}`.slice(0, 32),
        rulesVersionId: rulesVersion.id,
        rulesAcceptedAt: new Date(),
        registeredAt: new Date(),
        confirmedAt: new Date(),
        licenseAccepted: true,
        licenseAcceptedAt: new Date(),
        declaredAgeYears: 30,
        answersJson: {},
      },
    });
    const entry = await prisma.fotorankContestEntry.create({
      data: {
        contestId: contest.id,
        categoryId: amateur.id,
        registrationId: reg.id,
        authorUserId: u.id,
        status: "CONFIRMED",
        technicalSummaryStatus: "APPROVED",
        manualReviewStatus: "NONE",
        admissionStatus: "ADMITTED",
        submittedAt: new Date(),
        confirmedAt: new Date(),
        imageUrl: "",
        title: `SFEF07B ${runId} ${i}`,
        entryNumber: `S7B-${runId.slice(-6)}-${i}`.toUpperCase(),
        metadataJson: {
          eligibility: {
            captureLocality: "Rosario",
            territoryConfirmedSantaFe: true,
            declaredDeviceKind: "SMARTPHONE",
            gpsPresent: false,
          },
        },
      },
    });
    // Preview sintético (key placeholder) para UI de jurado / conflicto — sin foto real.
    const juryAsset = await prisma.fotorankContestEntryAsset.create({
      data: {
        contestId: contest.id,
        registrationId: reg.id,
        entryId: entry.id,
        versionNumber: 1,
        kind: "JURY_PREVIEW",
        storageProvider: "r2",
        storageBucket: "fotorank-private-staging",
        storageKey: `fotorank/contests/${contest.id}/entries/${entry.id}/versions/1/jury/sfef07b-${runId}-${i}`,
        mimeType: "image/jpeg",
        extension: "jpg",
        originalFileName: null,
        fileSizeBytes: 1024,
        width: 800,
        height: 600,
        sha256: createHash("sha256").update(`sfef07b-${runId}-${i}`).digest("hex"),
        isActive: true,
        uploadedAt: new Date(),
        processedAt: new Date(),
      },
    });
    await prisma.fotorankContestEntry.update({
      where: { id: entry.id },
      data: { activeAssetId: juryAsset.id },
    });
    entryIds.push(entry.id);
  }

  const dry = await freezeAdmittedEntries({
    contestId: contest.id,
    organizerUserId: orgUser.id,
    categorySlugs: ["fotografo-amateur"],
    entryIds,
    dryRun: true,
  });
  if (!dry.selectionHash || !dry.batchId) throw new Error("freeze dry-run failed");
  const applied = await freezeAdmittedEntries({
    contestId: contest.id,
    organizerUserId: orgUser.id,
    categorySlugs: ["fotografo-amateur"],
    entryIds,
    dryRun: false,
    batchId: dry.batchId,
    selectionHash: dry.selectionHash,
    expectedCount: dry.expectedCount,
    confirmPhrase: `CONGELAR ${dry.expectedCount} OBRAS`,
  });
  const batchId = applied.batchId ?? dry.batchId;

  const methodConfig = {
    criteria: SANTA_FE_EN_FOCO_JURY_CRITERIA.map((c) => c.key),
    scale: { min: 1, max: 10 },
  };

  async function makeJudge(tag: string, assignmentType: "PRIMARY" | "BACKUP" = "PRIMARY") {
    const email = `sfef07b-${tag}-${runId}@fotorank.test`;
    const acc = await prisma.fotorankJudgeAccount.create({
      data: {
        workspaceId: workspace!.id,
        email,
        passwordHash: hashPassword(JUDGE_PASSWORD),
        accountStatus: "ACTIVE",
        profile: {
          create: {
            firstName: tag,
            lastName: "SFEF07B",
            publicSlug: `sfef07b-${tag}-${runId}`,
            isPublic: false,
          },
        },
        organizationMemberships: {
          create: {
            organizationId: contest!.organizationId,
            membershipStatus: "ACTIVE",
          },
        },
      },
    });
    await prisma.fotorankJudgeAssignment.create({
      data: {
        judgeAccountId: acc.id,
        organizationId: contest!.organizationId,
        contestId: contest!.id,
        categoryId: amateur!.id,
        assignmentType,
        assignmentStatus: "ACCEPTED",
        methodType: "CRITERIA_BASED",
        methodConfigJson: methodConfig,
        allowVoteEdit: false,
        createdByUserId: orgUser.id,
        admissionBatchId: batchId,
      },
    });
    return { id: acc.id, email };
  }

  const j0 = await makeJudge("j0");
  const j1 = await makeJudge("j1");
  const j2 = await makeJudge("j2");
  const backup = await makeJudge("backup", "BACKUP");

  // Invitado formal (cuenta + assignment INVITATION_SENT + token)
  const inviteEmail = `sfef07b-juror-${runId}@fotorank.test`;
  const inviteAcc = await prisma.fotorankJudgeAccount.create({
    data: {
      workspaceId: workspace.id,
      email: inviteEmail,
      passwordHash: hashPassword(JUDGE_PASSWORD),
      accountStatus: "ACTIVE",
      profile: {
        create: {
          firstName: "Invitee",
          lastName: "SFEF07B",
          publicSlug: `sfef07b-juror-${runId}`,
          isPublic: false,
        },
      },
      organizationMemberships: {
        create: {
          organizationId: contest.organizationId,
          membershipStatus: "ACTIVE",
        },
      },
    },
  });
  await prisma.fotorankJudgeAssignment.create({
    data: {
      judgeAccountId: inviteAcc.id,
      organizationId: contest.organizationId,
      contestId: contest.id,
      categoryId: amateur.id,
      assignmentType: "PRIMARY",
      assignmentStatus: "INVITATION_SENT",
      methodType: "CRITERIA_BASED",
      methodConfigJson: methodConfig,
      allowVoteEdit: false,
      createdByUserId: orgUser.id,
      admissionBatchId: batchId,
    },
  });
  const plainToken = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(plainToken).digest("hex");
  const invitation = await prisma.fotorankJudgeInvitation.create({
    data: {
      organizationId: contest.organizationId,
      contestId: contest.id,
      categoryId: amateur.id,
      judgeAccountId: inviteAcc.id,
      email: inviteEmail,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitationStatus: "SENT",
      sentByUserId: orgUser.id,
    },
  });
  await enqueueJuryNotificationIntent({
    contestId: contest.id,
    kind: "JURY_INVITATION",
    metadata: { invitationId: invitation.id, channel: "secure_panel_link" },
  });
  const inviteUrl = buildJudgeInvitationRegistrationUrl(plainToken);

  // Tokens inválidos / expirado / revocado para E2E negativo
  const expiredToken = randomBytes(24).toString("hex");
  await prisma.fotorankJudgeInvitation.create({
    data: {
      organizationId: contest.organizationId,
      contestId: contest.id,
      categoryId: amateur.id,
      email: `sfef07b-expired-${runId}@fotorank.test`,
      tokenHash: createHash("sha256").update(expiredToken).digest("hex"),
      expiresAt: new Date(Date.now() - 3600_000),
      invitationStatus: "SENT",
      sentByUserId: orgUser.id,
    },
  });
  const revokedToken = randomBytes(24).toString("hex");
  await prisma.fotorankJudgeInvitation.create({
    data: {
      organizationId: contest.organizationId,
      contestId: contest.id,
      categoryId: amateur.id,
      email: `sfef07b-revoked-${runId}@fotorank.test`,
      tokenHash: createHash("sha256").update(revokedToken).digest("hex"),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitationStatus: "REVOKED",
      sentByUserId: orgUser.id,
    },
  });

  const session = await ensureDraftScoringSession({
    contestId: contest.id,
    admissionBatchId: batchId,
    actorUserId: orgUser.id,
  });
  await activateRubric({
    contestId: contest.id,
    rubricId: session.rubricId,
    actorUserId: orgUser.id,
  });
  await openScoringSession({
    contestId: contest.id,
    sessionId: session.id,
    actorUserId: orgUser.id,
  });

  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: batchId },
    select: { id: true, entryId: true, anonymousCode: true },
  });
  const snapByEntry = new Map(snapshots.map((s) => [s.entryId, s.id]));
  const snapIds = entryIds.map((id) => {
    const snapId = snapByEntry.get(id);
    if (!snapId) throw new Error(`missing snapshot for entry ${id}`);
    return snapId;
  });

  const credsPath = "/tmp/sfef-07b-creds.env";
  writeFileSync(
    credsPath,
    [
      `SFEF_07B_ORG_EMAIL=${orgEmail}`,
      `SFEF_07B_ORG_PASSWORD=${ORG_PASSWORD}`,
      `SFEF_07B_CONTEST_ID=${contest.id}`,
      `SFEF_07B_BATCH_ID=${batchId}`,
      `SFEF_07B_SESSION_ID=${session.id}`,
      `SFEF_07B_CATEGORY_ID=${amateur.id}`,
      `SFEF_07B_JUDGE_PASSWORD=${JUDGE_PASSWORD}`,
      `SFEF_07B_J0_EMAIL=${j0.email}`,
      `SFEF_07B_J0_ID=${j0.id}`,
      `SFEF_07B_J1_EMAIL=${j1.email}`,
      `SFEF_07B_J1_ID=${j1.id}`,
      `SFEF_07B_J2_EMAIL=${j2.email}`,
      `SFEF_07B_J2_ID=${j2.id}`,
      `SFEF_07B_BACKUP_EMAIL=${backup.email}`,
      `SFEF_07B_BACKUP_ID=${backup.id}`,
      `SFEF_07B_INVITEE_EMAIL=${inviteEmail}`,
      `SFEF_07B_INVITEE_ID=${inviteAcc.id}`,
      `SFEF_07B_INVITE_TOKEN=${plainToken}`,
      `SFEF_07B_INVITE_URL=${inviteUrl}`,
      `SFEF_07B_INVITATION_ID=${invitation.id}`,
      `SFEF_07B_EXPIRED_TOKEN=${expiredToken}`,
      `SFEF_07B_REVOKED_TOKEN=${revokedToken}`,
      `SFEF_07B_ENTRY_0=${entryIds[0]}`,
      `SFEF_07B_ENTRY_1=${entryIds[1]}`,
      `SFEF_07B_ENTRY_2=${entryIds[2]}`,
      `SFEF_07B_ENTRY_3=${entryIds[3]}`,
      `SFEF_07B_SNAP_0=${snapIds[0]}`,
      `SFEF_07B_SNAP_1=${snapIds[1]}`,
      `SFEF_07B_SNAP_2=${snapIds[2]}`,
      `SFEF_07B_SNAP_3=${snapIds[3]}`,
      `SFEF_07B_RUN_ID=${runId}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        contestId: contest.id,
        batchId,
        sessionId: session.id,
        invitationId: invitation.id,
        snapshots: snapshots.length,
        inviteUrlPath: inviteUrl.split("?")[0],
        credsPath,
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
