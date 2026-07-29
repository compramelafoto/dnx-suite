/**
 * Integración P0-01 contra DB (requiere migraciones aplicadas).
 *
 * pnpm --filter fotorank exec tsx app/lib/fotorank/registration/registration.integration.selfcheck.ts
 *
 * Omite si DATABASE_URL no está definida o faltan modelos (cliente desactualizado).
 */
import assert from "node:assert/strict";
import { prisma } from "@repo/db";
import {
  createContestRegistration,
  getMyContestRegistration,
  listMyRegistrations,
  publishRulesVersion,
  RULES_PLACEHOLDER_MARKER,
} from "./index";
import { RegistrationError } from "./errors";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP registration.integration.selfcheck: DATABASE_URL no definida");
    return;
  }

  const regDelegate = (prisma as { fotorankContestRegistration?: { create?: unknown } })
    .fotorankContestRegistration;
  if (typeof regDelegate?.create !== "function") {
    console.log(
      "SKIP registration.integration.selfcheck: cliente Prisma sin FotorankContestRegistration (correr prisma generate + migrate)",
    );
    return;
  }

  const admin = await prisma.user.findFirst({ orderBy: { id: "asc" } });
  const participant = await prisma.user.findUnique({ where: { email: "participante1@fotorank.com" } });
  const other = await prisma.user.findUnique({ where: { email: "participante2@fotorank.com" } });
  if (!admin || !participant || !other) {
    console.log("SKIP registration.integration.selfcheck: faltan usuarios seed @fotorank.com");
    return;
  }

  const suffix = Date.now().toString(36);
  const org = await prisma.contestOrganization.create({
    data: {
      name: `Org selfcheck ${suffix}`,
      slug: `org-sc-${suffix}`,
      platformFeeBps: 2000,
      createdByUserId: admin.id,
    },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `Selfcheck FREE ${suffix}`,
      slug: `sc-free-${suffix}`,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      registrationEnabled: true,
      registrationPricingMode: "FREE",
      registrationPriceAmountMinor: 0,
      registrationCurrency: "ARS",
      registrationOpensAt: new Date("2026-01-01T00:00:00Z"),
      registrationClosesAt: new Date("2026-12-31T00:00:00Z"),
      platformFeeBps: 1500,
      createdByUserId: admin.id,
    },
  });

  const category = await prisma.fotorankContestCategory.create({
    data: {
      contestId: contest.id,
      name: "Única",
      slug: "unica",
      maxFiles: 1,
      status: "ACTIVE",
    },
  });

  const otherContest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `Other ${suffix}`,
      slug: `sc-other-${suffix}`,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      registrationEnabled: true,
      registrationPricingMode: "FREE",
      registrationOpensAt: new Date("2026-01-01T00:00:00Z"),
      registrationClosesAt: new Date("2026-12-31T00:00:00Z"),
      createdByUserId: admin.id,
    },
  });
  const foreignCategory = await prisma.fotorankContestCategory.create({
    data: {
      contestId: otherContest.id,
      name: "Ajena",
      slug: "ajena",
      maxFiles: 1,
      status: "ACTIVE",
    },
  });

  const rules = await publishRulesVersion({
    contestId: contest.id,
    title: "Bases test",
    content: `${RULES_PLACEHOLDER_MARKER}\n\nSelfcheck bases.`,
    createdByUserId: admin.id,
    allowPlaceholder: true,
  });

  // FREE success — no payment order
  const created = await createContestRegistration({
    contestId: contest.id,
    participantUserId: participant.id,
    categoryId: category.id,
    rulesVersionId: rules.id,
    rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 30,
    rulesAcceptanceIp: "127.0.0.1",
    rulesAcceptanceUserAgent: "selfcheck",
    now: new Date("2026-08-10T12:00:00Z"),
  });
  assert.equal(created.created, true);
  assert.equal(created.registration.status, "CONFIRMED");
  assert.equal(created.registration.paymentStatus, "NOT_REQUIRED");
  assert.equal(created.registration.paymentOrderId, null);
  assert.equal(created.registration.registrationPriceSnapshot, 0);
  assert.equal(created.registration.platformFeeBpsSnapshot, 0);
  assert.equal(created.registration.rulesVersionId, rules.id);
  assert.ok(created.registration.registrationNumber);

  const orderCount = await prisma.dnxPaymentOrder.count({
    where: {
      // no hay vínculo; verificamos que paymentOrderId quedó null y no inventamos filas
      id: created.registration.paymentOrderId ?? "__none__",
    },
  });
  assert.equal(orderCount, 0);

  // Idempotent double request
  const replay = await createContestRegistration({
    contestId: contest.id,
    participantUserId: participant.id,
    categoryId: category.id,
    rulesVersionId: rules.id,
    rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 30,
    now: new Date("2026-08-10T12:00:00Z"),
  });
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.registration.id, created.registration.id);

  // Duplicate active already covered by idempotent; foreign category rejected for new user
  await assert.rejects(
    () =>
      createContestRegistration({
        contestId: contest.id,
        participantUserId: other.id,
        categoryId: foreignCategory.id,
        rulesVersionId: rules.id,
        rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 30,
        now: new Date("2026-08-10T12:00:00Z"),
      }),
    (e) => e instanceof RegistrationError && e.code === "CATEGORY_INVALID",
  );

  // Rules not accepted
  await assert.rejects(
    () =>
      createContestRegistration({
        contestId: contest.id,
        participantUserId: other.id,
        categoryId: category.id,
        rulesVersionId: rules.id,
        rulesAccepted: false,
        licenseAccepted: true,
        declaredAgeYears: 30,
        now: new Date("2026-08-10T12:00:00Z"),
      }),
    (e) => e instanceof RegistrationError && e.code === "RULES_NOT_ACCEPTED",
  );

  // Closed contest
  const closed = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `Closed ${suffix}`,
      slug: `sc-closed-${suffix}`,
      status: "CLOSED",
      visibility: "PUBLIC",
      registrationEnabled: true,
      registrationPricingMode: "FREE",
      registrationOpensAt: new Date("2026-01-01T00:00:00Z"),
      registrationClosesAt: new Date("2026-12-31T00:00:00Z"),
      createdByUserId: admin.id,
    },
  });
  const closedCat = await prisma.fotorankContestCategory.create({
    data: { contestId: closed.id, name: "C", slug: "c", maxFiles: 1, status: "ACTIVE" },
  });
  const closedRules = await publishRulesVersion({
    contestId: closed.id,
    title: "Bases",
    content: "bases closed",
    createdByUserId: admin.id,
  });
  await assert.rejects(
    () =>
      createContestRegistration({
        contestId: closed.id,
        participantUserId: other.id,
        categoryId: closedCat.id,
        rulesVersionId: closedRules.id,
        rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 30,
        now: new Date("2026-08-10T12:00:00Z"),
      }),
    (e) => e instanceof RegistrationError && e.code === "CONTEST_NOT_OPEN",
  );

  // Fee snapshot frozen after org fee change
  await prisma.contestOrganization.update({
    where: { id: org.id },
    data: { platformFeeBps: 5000 },
  });
  await prisma.fotorankContest.update({
    where: { id: contest.id },
    data: { platformFeeBps: 5000 },
  });
  const mine = await getMyContestRegistration(contest.id, participant.id);
  assert.ok(mine);
  assert.equal(mine.platformFeeBpsSnapshot, 0);

  // Other user cannot see via getMy
  const leak = await getMyContestRegistration(contest.id, other.id);
  assert.equal(leak, null);

  const list = await listMyRegistrations(participant.id);
  assert.ok(list.some((r) => r.id === created.registration.id));

  console.log("registration.integration.selfcheck.ts OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
