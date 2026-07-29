/**
 * Integración P0-09B — DB local.
 * DATABASE_URL=...staging pnpm --filter fotorank run test:rules-lifecycle:integration
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import { assertSafeFotoRankDatabaseUrl } from "../../../../scripts/assert-safe-database-url";
import { buildSantaFeEnFoco2026Configuration } from "../rules-config/santa-fe-en-foco-2026";
import { saveDraftConfiguration, publishConfigurationVersion } from "../rules-config/service";
import {
  approveRulesVersion,
  importRulesDocument,
  markLegalReview,
  publishContestRulesVersion,
  requestRulesChanges,
  seedSantaFeRulesDraft,
  submitRulesForReview,
  RulesLifecycleError,
} from "./service";
import { buildChatGptRulesPrompt } from "../rules-config/chatgpt-prompt";
import { createContestRegistration } from "../registration/registration-service";
import { RegistrationError } from "../registration/errors";
import { compareRulesTextWithConfiguration, hasBlockingConflicts } from "./compare";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL no definida");
    return;
  }
  assertSafeFotoRankDatabaseUrl();

  if (typeof (prisma as { fotorankContestRulesAuditEvent?: unknown }).fotorankContestRulesAuditEvent !== "object") {
    console.log("SKIP: cliente Prisma sin modelos P0-09B (generate + migrate)");
    return;
  }

  const suffix = Date.now().toString(36);
  const password = createHash("sha256").update(suffix).digest("hex");
  const admin = await prisma.user.create({
    data: { email: `rl-admin-${suffix}@fotorank.local`, name: "RL Admin", password },
  });
  const reviewer = await prisma.user.create({
    data: { email: `rl-rev-${suffix}@fotorank.local`, name: "RL Rev", password },
  });
  const adult = await prisma.user.create({
    data: { email: `rl-adult-${suffix}@fotorank.local`, name: "Adult", password },
  });
  const minor = await prisma.user.create({
    data: { email: `rl-minor-${suffix}@fotorank.local`, name: "Minor", password },
  });

  const org = await prisma.contestOrganization.create({
    data: {
      name: `Org RL ${suffix}`,
      slug: `org-rl-${suffix}`,
      platformFeeBps: 0,
      createdByUserId: admin.id,
    },
  });
  await prisma.contestOrganizationMember.create({
    data: { organizationId: org.id, userId: admin.id, role: "OWNER", status: "ACTIVE" },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: "RL Test",
      slug: `rl-${suffix}`,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      createdByUserId: admin.id,
      timezone: "America/Argentina/Cordoba",
      registrationEnabled: true,
      registrationPricingMode: "FREE",
      registrationOpensAt: new Date("2026-08-01T03:00:00.000Z"),
      registrationClosesAt: new Date("2026-10-01T02:59:59.999Z"),
      submissionOpensAt: new Date("2026-08-01T03:00:00.000Z"),
      submissionDeadline: new Date("2026-10-01T02:59:59.999Z"),
    },
  });

  const config = buildSantaFeEnFoco2026Configuration();
  config.identity.slug = contest.slug;
  const draftCfg = await saveDraftConfiguration({
    contestId: contest.id,
    config,
    createdByUserId: admin.id,
  });
  const publishedCfg = await publishConfigurationVersion({
    contestId: contest.id,
    versionId: draftCfg.id,
    actorUserId: admin.id,
    allowPendingHuman: true,
  });

  const prompt = buildChatGptRulesPrompt(config);
  assert.ok(prompt.includes("declaredConfigurationHash"));

  // conflicto detectado
  const conflictImport = await importRulesDocument({
    contestId: contest.id,
    configurationVersionId: publishedCfg.configurationVersionId,
    title: "Bad",
    content: "Participación gratuita. El GPS será obligatorio. Una sola fotografía.",
    createdByUserId: admin.id,
  });
  assert.equal(hasBlockingConflicts(conflictImport.compare) || conflictImport.compare.some((c) => c.status === "CONFLICT"), true);

  // borrador SF
  const sf = await seedSantaFeRulesDraft({
    contestId: contest.id,
    configurationVersionId: publishedCfg.configurationVersionId,
    createdByUserId: admin.id,
  });
  assert.equal(sf.legalReviewStatus, "PENDING");

  await submitRulesForReview({
    contestId: contest.id,
    rulesVersionId: sf.rulesVersionId,
    actorUserId: admin.id,
  });

  // publicación sin aprobación bloqueada
  let blockedNoApprove = false;
  try {
    await publishContestRulesVersion({
      contestId: contest.id,
      rulesVersionId: sf.rulesVersionId,
      actorUserId: admin.id,
      allowLegalPendingForLocal: true,
    });
  } catch (e) {
    blockedNoApprove = e instanceof RulesLifecycleError && e.code === "NOT_APPROVED";
  }
  assert.equal(blockedNoApprove, true);

  await approveRulesVersion({
    contestId: contest.id,
    rulesVersionId: sf.rulesVersionId,
    actorUserId: reviewer.id,
  });

  // legal pending bloquea sin allow
  let blockedLegal = false;
  try {
    await publishContestRulesVersion({
      contestId: contest.id,
      rulesVersionId: sf.rulesVersionId,
      actorUserId: admin.id,
      allowLegalPendingForLocal: false,
    });
  } catch (e) {
    blockedLegal = e instanceof RulesLifecycleError && e.code === "LEGAL_PENDING";
  }
  assert.equal(blockedLegal, true);

  await markLegalReview({
    contestId: contest.id,
    rulesVersionId: sf.rulesVersionId,
    actorUserId: admin.id,
    status: "REVIEWED",
    notes: "Revisión jurídica OK para staging",
  });

  const published = await publishContestRulesVersion({
    contestId: contest.id,
    rulesVersionId: sf.rulesVersionId,
    actorUserId: admin.id,
    allowLegalPendingForLocal: false,
  });
  assert.ok(published.contentHash);

  // inmutable
  let immutable = false;
  try {
    await publishContestRulesVersion({
      contestId: contest.id,
      rulesVersionId: sf.rulesVersionId,
      actorUserId: admin.id,
    });
  } catch {
    immutable = true;
  }
  assert.equal(immutable, true);

  const cats = await prisma.fotorankContestCategory.findMany({
    where: { contestId: contest.id, status: "ACTIVE" },
  });
  assert.ok(cats.length >= 1);

  const nowOpen = new Date("2026-08-15T15:00:00.000Z");

  // adulto
  const adultReg = await createContestRegistration({
    contestId: contest.id,
    participantUserId: adult.id,
    categoryId: cats[0]!.id,
    rulesVersionId: published.rulesVersionId,
    rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 30,
    now: nowOpen,
  });
  assert.ok(adultReg.registration.rulesVersionId);
  const adultRow = await prisma.fotorankContestRegistration.findUniqueOrThrow({
    where: { id: adultReg.registration.id },
  });
  assert.ok(adultRow.rulesContentHashSnapshot);
  assert.ok(adultRow.configurationHashSnapshot);
  assert.equal(adultRow.licenseAccepted, true);

  // menor sin auth
  let minorBlocked = false;
  try {
    await createContestRegistration({
      contestId: contest.id,
      participantUserId: minor.id,
      categoryId: cats[0]!.id,
      rulesVersionId: published.rulesVersionId,
      rulesAccepted: true,
      licenseAccepted: true,
      declaredAgeYears: 16,
      now: nowOpen,
    });
  } catch (e) {
    minorBlocked = e instanceof RegistrationError && e.code === "MINOR_AUTH_REQUIRED";
  }
  assert.equal(minorBlocked, true);

  const minorOk = await createContestRegistration({
    contestId: contest.id,
    participantUserId: minor.id,
    categoryId: cats[0]!.id,
    rulesVersionId: published.rulesVersionId,
    rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 16,
    now: nowOpen,
    minorAuthorization: {
      guardianName: "Tutor Test",
      relationship: "Madre",
      declarationAccepted: true,
    },
  });
  const minorAuth = await prisma.fotorankMinorAuthorization.findUnique({
    where: { registrationId: minorOk.registration.id },
  });
  assert.ok(minorAuth);

  // nueva config no altera aceptación previa
  const prevHash = adultRow.rulesContentHashSnapshot;
  const cfg2 = buildSantaFeEnFoco2026Configuration();
  cfg2.identity.officialName = "Santa Fe en Foco 2026 (rev)";
  cfg2.identity.slug = contest.slug;
  const d2 = await saveDraftConfiguration({
    contestId: contest.id,
    config: cfg2,
    createdByUserId: admin.id,
  });
  await publishConfigurationVersion({
    contestId: contest.id,
    versionId: d2.id,
    actorUserId: admin.id,
    allowPendingHuman: true,
  });
  const adultAgain = await prisma.fotorankContestRegistration.findUniqueOrThrow({
    where: { id: adultReg.registration.id },
  });
  assert.equal(adultAgain.rulesContentHashSnapshot, prevHash);

  void requestRulesChanges;
  void compareRulesTextWithConfiguration;

  console.log(
    JSON.stringify(
      {
        ok: true,
        contestId: contest.id,
        rulesVersionId: published.rulesVersionId,
        adultRegistrationId: adultReg.registration.id,
        minorRegistrationId: minorOk.registration.id,
      },
      null,
      2,
    ),
  );
  console.log("rules-lifecycle.integration.selfcheck.ts OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
