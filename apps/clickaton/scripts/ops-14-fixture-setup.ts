/**
 * ETAPA 14 — aprobar subconjunto controlado del catálogo 55 + edición fixture
 * con exactamente 10 consignas APPROVED (snapshots + ventanas + Modo Test).
 *
 *   SFEF14_ALLOW_PROD_FIXTURE=1 DATABASE_URL=... \
 *     pnpm --filter clickaton exec tsx scripts/ops-14-fixture-setup.ts
 *
 * NO aprueba masivamente las 55. Solo 12 controladas (10 asignadas + 2 reserva).
 * Cleanup posterior NO revierte esas aprobaciones (consignas globales).
 */
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  approve,
  assignToEdition,
  INITIAL_SOURCE_PREFIX,
  reorderEditionPrompts,
  seedInitialCatalog,
  submitForReview,
  updateItem,
} from "@repo/photo-prompt-library";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const PASSWORD = `Ck14-A-${randomBytes(3).toString("hex")}!`;
const APPROVE_COUNT = 12;
const ASSIGN_COUNT = 10;

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) throw new Error("ABORT host");
  if (process.env.SFEF14_ALLOW_PROD_FIXTURE !== "1") throw new Error("ABORT flag");

  const prisma = new PrismaClient();
  const execId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  const slug = `clickaton-fr-14-fixture-${execId}`;

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
    submissions: await prisma.clickatonPhotoSubmission.count({
      where: { editionId: COMMERCIAL_EDITION_ID },
    }),
  };

  const seed = await seedInitialCatalog(prisma);
  const catalogBefore = await prisma.photoPromptLibraryItem.count({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
  });
  if (catalogBefore < 55) throw new Error(`ABORT catalog size ${catalogBefore}`);

  const sa = await prisma.user.findUnique({
    where: { email: "cuart.daniel@gmail.com" },
    select: { id: true },
  });
  if (!sa) throw new Error("SA missing");

  // Diversidad temática: 1 DRAFT por theme (hasta 11) + relleno hasta 12.
  const themes = await prisma.photoPromptTheme.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });
  const picked: { id: string; title: string; themeName: string; sourceKey: string | null }[] =
    [];
  for (const theme of themes) {
    if (picked.length >= APPROVE_COUNT) break;
    const item = await prisma.photoPromptLibraryItem.findFirst({
      where: {
        themeId: theme.id,
        status: "DRAFT",
        sourceKey: { startsWith: INITIAL_SOURCE_PREFIX },
        id: { notIn: picked.map((p) => p.id) },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, sourceKey: true },
    });
    if (item) {
      picked.push({
        id: item.id,
        title: item.title,
        themeName: theme.name,
        sourceKey: item.sourceKey,
      });
    }
  }
  while (picked.length < APPROVE_COUNT) {
    const item = await prisma.photoPromptLibraryItem.findFirst({
      where: {
        status: "DRAFT",
        sourceKey: { startsWith: INITIAL_SOURCE_PREFIX },
        id: { notIn: picked.map((p) => p.id) },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        sourceKey: true,
        theme: { select: { name: true } },
      },
    });
    if (!item) break;
    picked.push({
      id: item.id,
      title: item.title,
      themeName: item.theme.name,
      sourceKey: item.sourceKey,
    });
  }
  if (picked.length < ASSIGN_COUNT) {
    throw new Error(`ABORT insufficient DRAFT to approve: ${picked.length}`);
  }

  const approvedIds: string[] = [];
  for (const row of picked) {
    // Revisión de contenido mínima (no cambia significado): tag ops14 + micro-edit description append audit trail via update.
    await updateItem(
      row.id,
      {
        tags: ["ops14", "etapa14", ...(row.themeName ? [row.themeName.toLowerCase()] : [])],
      },
      { prisma },
    );
    await submitForReview(row.id, sa.id, { prisma });
    await approve(row.id, sa.id, { prisma });
    await prisma.photoPromptLibraryItem.update({
      where: { id: row.id },
      data: {
        metadataJson: {
          ops14Approved: true,
          ops14ExecId: execId,
          approvedForControlledTest: true,
        },
      },
    });
    approvedIds.push(row.id);
  }

  const org = await prisma.contestOrganization.create({
    data: {
      name: `Ops Fixture Org 14 ${execId}`,
      slug: `ops-fixture-org-14-${execId}`,
      createdByUserId: sa.id,
      members: { create: { userId: sa.id, role: "OWNER", status: "ACTIVE" } },
    },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `Clickatón 14 Controlled Fixture ${execId}`,
      slug: `ck-fr-14-fixture-${execId}`,
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
      name: `CK 14 Fixture ${execId}`,
      slug,
      shortDescription: "OPS FIXTURE 14 — aprobación + 10 reales + Modo Test",
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
      name: "Fixture 14",
      code: `FX14-${execId}`,
      priceAmount: 0,
      currency: "ARS",
      capacity: 20,
      isActive: true,
    },
  });

  const assignedPromptIds: string[] = [];
  const assignIds = approvedIds.slice(0, ASSIGN_COUNT);
  for (const libraryItemId of assignIds) {
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

  // Orden explícito 1..10 (reverse then reorder to prove order is edition-local).
  const reversed = [...assignedPromptIds].reverse();
  await reorderEditionPrompts(edition.id, reversed, sa.id, { prisma });
  await reorderEditionPrompts(edition.id, assignedPromptIds, sa.id, { prisma });

  const email = `clickaton14-${execId}-01@fotorank.test`;
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "CK14 Fixture",
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
      firstName: "CK14",
      lastName: "Fixture",
      ticketTypeId: ticket.id,
      status: "CONFIRMED",
      paymentStatus: "APPROVED",
      confirmedAt: now,
      acceptedTermsAt: now,
      acceptedImageAt: now,
      sequenceNumber: 1,
      visibleCode: `X4${execId.slice(-4).toUpperCase()}`,
      isOpsTest: false,
    },
  });

  const testEmail = `clickaton14-${execId}-test@fotorank.test`;
  const testUser = await prisma.user.upsert({
    where: { email: testEmail },
    create: {
      email: testEmail,
      name: "CK14 Ops Test",
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
      lastName: "Mode14",
      ticketTypeId: ticket.id,
      status: "CONFIRMED",
      paymentStatus: "NOT_REQUIRED",
      confirmedAt: now,
      acceptedTermsAt: now,
      acceptedImageAt: now,
      sequenceNumber: 900_014,
      visibleCode: `T4${execId.slice(-4).toUpperCase()}`,
      isOpsTest: true,
    },
  });

  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId: edition.id },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      sequence: true,
      titleSnapshot: true,
      libraryItemId: true,
      libraryVersion: true,
    },
  });

  const catalogAfter = await prisma.photoPromptLibraryItem.count({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
  });
  const approvedCatalog = await prisma.photoPromptLibraryItem.count({
    where: {
      sourceKey: { startsWith: INITIAL_SOURCE_PREFIX },
      status: "APPROVED",
    },
  });
  const draftCatalog = await prisma.photoPromptLibraryItem.count({
    where: {
      sourceKey: { startsWith: INITIAL_SOURCE_PREFIX },
      status: "DRAFT",
    },
  });

  const outPath = "/tmp/clickaton-14-fixture.env";
  writeFileSync(
    outPath,
    [
      `SFEF14_EXEC_ID=${execId}`,
      `SFEF14_PASSWORD=${PASSWORD}`,
      `SFEF14_EDITION_ID=${edition.id}`,
      `SFEF14_EDITION_SLUG=${edition.slug}`,
      `SFEF14_CONTEST_ID=${contest.id}`,
      `SFEF14_ORG_ID=${org.id}`,
      `SFEF14_TICKET_ID=${ticket.id}`,
      `SFEF14_REG_1=${reg.id}`,
      `SFEF14_USER_1_ID=${u.id}`,
      `SFEF14_USER_1_EMAIL=${u.email}`,
      `SFEF14_TEST_REG=${testReg.id}`,
      `SFEF14_TEST_USER_ID=${testUser.id}`,
      `SFEF14_TEST_EMAIL=${testUser.email}`,
      `SFEF14_APPROVED_IDS=${approvedIds.join(",")}`,
      `SFEF14_ASSIGNED_LIBRARY_IDS=${assignIds.join(",")}`,
      `SFEF14_RESERVE_LIBRARY_IDS=${approvedIds.slice(ASSIGN_COUNT).join(",")}`,
      `SFEF14_SNAPSHOT_PROBE_LIBRARY_ID=${assignIds[0]}`,
      `SFEF14_REVEAL_AT=${revealAt.toISOString()}`,
      `SFEF14_CAPTURE_START=${captureStart.toISOString()}`,
      `SFEF14_CAPTURE_END=${captureEnd.toISOString()}`,
      `SFEF14_UPLOAD_START=${uploadStart.toISOString()}`,
      `SFEF14_UPLOAD_END=${uploadEnd.toISOString()}`,
      `SFEF14_COMMERCIAL_REG_COUNT_BEFORE=${commercialBefore.regs}`,
      `SFEF14_COMMERCIAL_APPROVED_BEFORE=${commercialBefore.approved}`,
      `SFEF14_COMMERCIAL_PAID_BEFORE=${commercialBefore.paidOrders}`,
      `SFEF14_COMMERCIAL_SUBMISSIONS_BEFORE=${commercialBefore.submissions}`,
      `SFEF14_CATALOG_COUNT=${catalogAfter}`,
      `SFEF14_APPROVED_CATALOG=${approvedCatalog}`,
      `SFEF14_DRAFT_CATALOG=${draftCatalog}`,
      ...prompts.map((p, i) => `SFEF14_PROMPT_${i + 1}=${p.id}`),
      `SFEF14_SEED_CREATED=${seed.itemsCreated}`,
      `SFEF14_SEED_SKIPPED=${seed.itemsSkipped}`,
      ...picked.map(
        (p, i) =>
          `SFEF14_PICK_${i + 1}_TITLE="${p.title.replace(/"/g, "")}"`,
      ),
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
        approvedCatalog,
        draftCatalog,
        approvedIds: approvedIds.length,
        assignedPrompts: assignedPromptIds.length,
        sequences: prompts.map((p) => p.sequence),
        pickedTitles: picked.map((p) => `${p.themeName}: ${p.title}`),
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
