/**
 * ETAPA 13 — fixture ops con biblioteca + isOpsFixture.
 * Crea ítems OPS13_* temporales. Nunca borra ni muta el catálogo 55.
 *
 *   SFEF13_ALLOW_PROD_FIXTURE=1 DATABASE_URL=... \
 *     pnpm --filter @repo/db exec tsx ../../apps/clickaton/scripts/ops-13-fixture-setup.ts
 */
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  approve,
  assignToEdition,
  createItem,
  INITIAL_SOURCE_PREFIX,
  seedInitialCatalog,
  submitForReview,
} from "@repo/photo-prompt-library";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const PASSWORD = `Ck13-A-${randomBytes(3).toString("hex")}!`;

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) throw new Error("ABORT host");
  if (process.env.SFEF13_ALLOW_PROD_FIXTURE !== "1") throw new Error("ABORT flag");

  const prisma = new PrismaClient();
  const execId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  const slug = `clickaton-fr-13-fixture-${execId}`;

  const commercialBefore = {
    regs: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID },
    }),
    approved: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID, paymentStatus: "APPROVED" },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID, paymentOrderId: { not: null } },
    }),
  };

  const catalogBefore = await prisma.photoPromptLibraryItem.count({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
  });

  const seed = await seedInitialCatalog(prisma);

  const sa = await prisma.user.findUnique({
    where: { email: "cuart.daniel@gmail.com" },
    select: { id: true },
  });
  if (!sa) throw new Error("SA missing");

  const org = await prisma.contestOrganization.create({
    data: {
      name: `Ops Fixture Org 13 ${execId}`,
      slug: `ops-fixture-org-13-${execId}`,
      createdByUserId: sa.id,
      members: { create: { userId: sa.id, role: "OWNER", status: "ACTIVE" } },
    },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `Clickatón 13 Library Fixture ${execId}`,
      slug: `ck-fr-13-fixture-${execId}`,
      status: "PUBLISHED",
      visibility: "PRIVATE",
      experienceType: "MARATHON",
      distributionChannel: "CLICKATON",
      registrationEnabled: false,
      timezone: "America/Argentina/Buenos_Aires",
      createdByUserId: sa.id,
      categories: {
        create: { name: "General", slug: "general", status: "ACTIVE", sortOrder: 0 },
      },
    },
  });

  const now = new Date();
  const revealAt = new Date(now.getTime() + 5 * 60_000);
  const captureStart = new Date(now.getTime() + 5 * 60_000);
  const captureEnd = new Date(now.getTime() + 120 * 60_000);
  const uploadStart = new Date(now.getTime() + 5 * 60_000);
  const uploadEnd = new Date(now.getTime() + 240 * 60_000);

  const edition = await prisma.clickatonEdition.create({
    data: {
      name: `CK 13 Fixture ${execId}`,
      slug,
      shortDescription: "OPS FIXTURE 13 — prompt library",
      status: "DRAFT",
      isPublished: false,
      isOpsFixture: true,
      registrationEnabled: false,
      timezone: "America/Argentina/Buenos_Aires",
      fotorankContestId: contest.id,
      fotoRankSyncEnabled: true,
      fotoRankSyncMode: "POST_PAID",
      fotoRankValidationStatus: "VALID",
      fotoRankLastValidatedAt: now,
      uploadConfig: {
        create: {
          uploadsEnabled: true,
          canonicalAssetsEnabled: false,
          globalPromptReveal: true,
          eventRevealAt: revealAt,
          captureWindowStartsAt: captureStart,
          captureWindowEndsAt: captureEnd,
          uploadWindowStartsAt: uploadStart,
          uploadWindowEndsAt: uploadEnd,
          allowReplacement: true,
        },
      },
    },
  });

  const ticket = await prisma.clickatonTicketType.create({
    data: {
      editionId: edition.id,
      name: "Fixture 13",
      code: `FX13-${execId}`,
      priceAmount: 0,
      currency: "ARS",
      capacity: 20,
      isActive: true,
    },
  });

  const theme = await prisma.photoPromptTheme.findFirst({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!theme) throw new Error("No themes after seed");

  // 12 APPROVED temporales OPS13_* (no tocan el catálogo 55).
  const approvedIds: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const item = await createItem(
      {
        title: `Ops13 Approved ${execId} #${i}`,
        description: `Consigna temporal ops-13 #${i} para picker y asignación.`,
        themeId: theme.id,
        difficulty: i % 3 === 0 ? "HARD" : i % 2 === 0 ? "EASY" : "MEDIUM",
        inspirationType: i % 2 === 0 ? "DIRECTOR" : "VISUAL_STYLE",
        inspirationLabel: i % 2 === 0 ? "Fixture Director" : "Fixture Style",
        sourceKey: `OPS13_APPROVED_${execId}_${String(i).padStart(2, "0")}`,
        createdByUserId: sa.id,
        metadataJson: { opsFixture: true, execId },
      },
      { prisma },
    );
    await submitForReview(item.id, sa.id, { prisma });
    await approve(item.id, sa.id, { prisma });
    approvedIds.push(item.id);
  }

  const draftItem = await createItem(
    {
      title: `Ops13 Draft ${execId}`,
      description: "Borrador solo para Test Mode / fixture ops.",
      themeId: theme.id,
      sourceKey: `OPS13_DRAFT_${execId}`,
      createdByUserId: sa.id,
      metadataJson: { opsFixture: true, execId },
    },
    { prisma },
  );

  const assignedPromptIds: string[] = [];
  for (const libraryItemId of approvedIds.slice(0, 8)) {
    const { prompt } = await assignToEdition(
      {
        editionId: edition.id,
        libraryItemId,
        actorUserId: sa.id,
        allowDraftForOpsTest: false,
      },
      { prisma },
    );
    assignedPromptIds.push(prompt.id);
  }

  const email = `clickaton13-${execId}-01@fotorank.test`;
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "CK13 Fixture",
      password: hashPassword(PASSWORD),
      role: "CUSTOMER",
      globalRole: "USER",
      emailVerifiedAt: now,
    },
    update: { password: hashPassword(PASSWORD), emailVerifiedAt: now },
    select: { id: true, email: true },
  });

  const reg = await prisma.clickatonRegistration.create({
    data: {
      editionId: edition.id,
      userId: u.id,
      email: u.email,
      firstName: "CK13",
      lastName: "Fixture",
      ticketTypeId: ticket.id,
      status: "CONFIRMED",
      paymentStatus: "APPROVED",
      confirmedAt: now,
      acceptedTermsAt: now,
      acceptedImageAt: now,
      sequenceNumber: 1,
      visibleCode: `X3${execId.slice(-4).toUpperCase()}`,
      isOpsTest: false,
    },
  });

  const testEmail = `clickaton13-${execId}-test@fotorank.test`;
  const testUser = await prisma.user.upsert({
    where: { email: testEmail },
    create: {
      email: testEmail,
      name: "CK13 Ops Test",
      password: hashPassword(PASSWORD),
      role: "CUSTOMER",
      globalRole: "USER",
      emailVerifiedAt: now,
    },
    update: { emailVerifiedAt: now },
    select: { id: true, email: true },
  });
  const testReg = await prisma.clickatonRegistration.create({
    data: {
      editionId: edition.id,
      userId: testUser.id,
      email: testUser.email,
      firstName: "Test",
      lastName: "Mode",
      ticketTypeId: ticket.id,
      status: "CONFIRMED",
      paymentStatus: "NOT_REQUIRED",
      confirmedAt: now,
      acceptedTermsAt: now,
      acceptedImageAt: now,
      sequenceNumber: 900_013,
      visibleCode: `T3${execId.slice(-4).toUpperCase()}`,
      isOpsTest: true,
    },
  });

  const catalogAfter = await prisma.photoPromptLibraryItem.count({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
  });

  const outPath = "/tmp/clickaton-13-fixture.env";
  writeFileSync(
    outPath,
    [
      `SFEF13_EXEC_ID=${execId}`,
      `SFEF13_PASSWORD=${PASSWORD}`,
      `SFEF13_EDITION_ID=${edition.id}`,
      `SFEF13_EDITION_SLUG=${edition.slug}`,
      `SFEF13_CONTEST_ID=${contest.id}`,
      `SFEF13_ORG_ID=${org.id}`,
      `SFEF13_TICKET_ID=${ticket.id}`,
      `SFEF13_REG_1=${reg.id}`,
      `SFEF13_USER_1_ID=${u.id}`,
      `SFEF13_USER_1_EMAIL=${u.email}`,
      `SFEF13_TEST_REG=${testReg.id}`,
      `SFEF13_TEST_USER_ID=${testUser.id}`,
      `SFEF13_TEST_EMAIL=${testUser.email}`,
      `SFEF13_DRAFT_ITEM_ID=${draftItem.id}`,
      `SFEF13_THEME_ID=${theme.id}`,
      `SFEF13_APPROVED_IDS=${approvedIds.join(",")}`,
      `SFEF13_REVEAL_AT=${revealAt.toISOString()}`,
      `SFEF13_CAPTURE_START=${captureStart.toISOString()}`,
      `SFEF13_CAPTURE_END=${captureEnd.toISOString()}`,
      `SFEF13_UPLOAD_START=${uploadStart.toISOString()}`,
      `SFEF13_UPLOAD_END=${uploadEnd.toISOString()}`,
      `SFEF13_COMMERCIAL_REG_COUNT_BEFORE=${commercialBefore.regs}`,
      `SFEF13_COMMERCIAL_APPROVED_BEFORE=${commercialBefore.approved}`,
      `SFEF13_COMMERCIAL_PAID_BEFORE=${commercialBefore.paidOrders}`,
      `SFEF13_CATALOG_COUNT_BEFORE=${catalogBefore}`,
      `SFEF13_CATALOG_COUNT_AFTER_SETUP=${catalogAfter}`,
      ...assignedPromptIds.map((id, i) => `SFEF13_PROMPT_${i + 1}=${id}`),
      `SFEF13_SEED_CREATED=${seed.itemsCreated}`,
      `SFEF13_SEED_SKIPPED=${seed.itemsSkipped}`,
    ].join("\n") + "\n",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        editionId: edition.id,
        contestId: contest.id,
        slug,
        credsPath: outPath,
        commercialBefore,
        catalogBefore,
        catalogAfter,
        approvedReady: approvedIds.length,
        assignedPrompts: assignedPromptIds.length,
        draftItemId: draftItem.id,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
