/**
 * ETAPA 11E — setup edición fixture NO pública + contest FR + 10 prompts + users.
 *
 *   SFEF11E_ALLOW_PROD_FIXTURE=1 DATABASE_URL=... \
 *     pnpm --filter @repo/db exec tsx ../../apps/clickaton/scripts/ops-11e-fixture-setup.ts
 *
 * Creds → /tmp/clickaton-11e-fixture.env
 */
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"));
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const KEY_LEN = 64;
const PASSWORD = `Ck11e-A-${randomBytes(3).toString("hex")}!`;
const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const PROMPT_COUNT = 10;
const PARTICIPANT_COUNT = 4;

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${digest}`;
}

function assertProdFixtureAllowed() {
  const url = process.env.DATABASE_URL ?? "";
  const host = new URL(url).hostname;
  if (!host.includes("ep-dawn-dew")) {
    throw new Error(`ABORT host inesperado: ${host}. 11E espera dawn-dew.`);
  }
  if (process.env.SFEF11E_ALLOW_PROD_FIXTURE !== "1") {
    throw new Error("ABORT: SFEF11E_ALLOW_PROD_FIXTURE=1 requerido");
  }
}

async function main() {
  assertProdFixtureAllowed();
  const prisma = new PrismaClient();
  const execId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  const slug = `clickaton-fr-11e-fixture-${execId}`;

  const commercialBefore = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });
  const commercialApprovedBefore = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID, paymentStatus: "APPROVED" },
  });
  const commercialPaidOrdersBefore = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID, paymentOrderId: { not: null } },
  });

  const sa = await prisma.user.findUnique({
    where: { email: "cuart.daniel@gmail.com" },
    select: { id: true },
  });
  if (!sa) throw new Error("SA missing");

  const org = await prisma.contestOrganization.create({
    data: {
      name: `Ops Fixture Org 11E ${execId}`,
      slug: `ops-fixture-org-11e-${execId}`,
      createdByUserId: sa.id,
      members: {
        create: {
          userId: sa.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      },
    },
    select: { id: true },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `Clickatón 11E 10-Prompts Fixture ${execId}`,
      slug: `ck-fr-11e-fixture-${execId}`,
      status: "PUBLISHED",
      visibility: "PRIVATE",
      experienceType: "MARATHON",
      distributionChannel: "CLICKATON",
      registrationEnabled: false,
      timezone: "America/Argentina/Cordoba",
      createdByUserId: sa.id,
      categories: {
        create: {
          name: "General",
          slug: "general",
          status: "ACTIVE",
          sortOrder: 0,
        },
      },
    },
  });

  const edition = await prisma.clickatonEdition.create({
    data: {
      name: `CK 11E Fixture ${execId}`,
      slug,
      shortDescription: "OPS FIXTURE 11E — 10 consignas — no comercial / no pública",
      status: "DRAFT",
      isPublished: false,
      isOpsFixture: true,
      registrationEnabled: false,
      timezone: "America/Argentina/Cordoba",
      fotorankContestId: contest.id,
      fotoRankSyncEnabled: true,
      fotoRankSyncMode: "POST_PAID",
      fotoRankValidationStatus: "VALID",
      fotoRankLastValidatedAt: new Date(),
      uploadConfig: {
        create: {
          uploadsEnabled: true,
          canonicalAssetsEnabled: true,
        },
      },
    },
  });

  const ticket = await prisma.clickatonTicketType.create({
    data: {
      editionId: edition.id,
      name: "Fixture Ticket 11E",
      code: `FXE-${execId}`,
      priceAmount: 0,
      currency: "ARS",
      capacity: 50,
      isActive: true,
    },
  });

  const now = new Date();
  const prompts = [];
  for (let i = 1; i <= PROMPT_COUNT; i++) {
    const revealOffsetMin = (i - 1) * 3;
    const closeOffsetMin = 45 + (i - 1) * 3;
    const revealAt = new Date(now.getTime() + revealOffsetMin * 60_000 - (i === 1 ? 120_000 : 0));
    const closeAt = new Date(now.getTime() + closeOffsetMin * 60_000);
    const p = await prisma.clickatonPrompt.create({
      data: {
        editionId: edition.id,
        sequence: i,
        internalName: `Fixture 11E Prompt ${i}`,
        title: `Consigna ${i}`,
        instructions: `Instrucciones sintéticas 11E #${i}: capturá una escena genérica de prueba.`,
        status: i === 1 ? "RELEASED" : "LOCKED",
        releaseMode: "SCHEDULED",
        captureStartsAt: revealAt,
        captureEndsAt: closeAt,
        uploadStartsAt: revealAt,
        uploadEndsAt: closeAt,
        minEntries: 1,
        maxEntries: 1,
        allowReplacement: true,
        replacementDeadline: closeAt,
        gpsMode: "OPTIONAL",
        createdByUserId: sa.id,
        releasedAt: i === 1 ? now : null,
        releasedByUserId: i === 1 ? sa.id : null,
      },
    });
    prompts.push(p);
  }

  const users = [];
  for (let i = 1; i <= PARTICIPANT_COUNT; i++) {
    const email = `clickaton11e-${execId}-0${i}@fotorank.test`;
    const u = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: `CK11E Fixture ${i}`,
        password: hashPassword(PASSWORD),
        role: "CUSTOMER",
        globalRole: "USER",
        emailVerifiedAt: new Date(),
        province: "Santa Fe",
        country: "Argentina",
      },
      update: {
        password: hashPassword(PASSWORD),
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true },
    });
    const reg = await prisma.clickatonRegistration.create({
      data: {
        editionId: edition.id,
        userId: u.id,
        email: u.email,
        firstName: "CK11E",
        lastName: `Fixture${i}`,
        ticketTypeId: ticket.id,
        status: "CONFIRMED",
        paymentStatus: "APPROVED",
        confirmedAt: now,
        acceptedTermsAt: now,
        acceptedImageAt: now,
        sequenceNumber: i,
        visibleCode: `XE${execId.slice(-4).toUpperCase()}${i}`,
      },
    });
    users.push({ ...u, registrationId: reg.id });
  }

  const outPath = "/tmp/clickaton-11e-fixture.env";
  const lines = [
    `SFEF11E_EXEC_ID=${execId}`,
    `SFEF11E_PASSWORD=${PASSWORD}`,
    `SFEF11E_EDITION_ID=${edition.id}`,
    `SFEF11E_EDITION_SLUG=${edition.slug}`,
    `SFEF11E_CONTEST_ID=${contest.id}`,
    `SFEF11E_ORG_ID=${org.id}`,
    `SFEF11E_TICKET_ID=${ticket.id}`,
    `SFEF11E_COMMERCIAL_EDITION_ID=${COMMERCIAL_EDITION_ID}`,
    `SFEF11E_COMMERCIAL_REG_COUNT_BEFORE=${commercialBefore}`,
    `SFEF11E_COMMERCIAL_APPROVED_COUNT_BEFORE=${commercialApprovedBefore}`,
    `SFEF11E_COMMERCIAL_PAID_ORDERS_BEFORE=${commercialPaidOrdersBefore}`,
    `SFEF11E_PROMPT_COUNT=${PROMPT_COUNT}`,
    `SFEF11E_PARTICIPANT_COUNT=${PARTICIPANT_COUNT}`,
  ];
  for (let i = 0; i < prompts.length; i++) {
    lines.push(`SFEF11E_PROMPT_${i + 1}=${prompts[i]!.id}`);
  }
  for (let i = 0; i < users.length; i++) {
    lines.push(`SFEF11E_USER_${i + 1}_EMAIL=${users[i]!.email}`);
    lines.push(`SFEF11E_USER_${i + 1}_ID=${users[i]!.id}`);
    lines.push(`SFEF11E_REG_${i + 1}=${users[i]!.registrationId}`);
  }
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        execId,
        editionId: edition.id,
        contestId: contest.id,
        slug,
        promptCount: PROMPT_COUNT,
        participantCount: PARTICIPANT_COUNT,
        isOpsFixture: true,
        commercialRegCountBefore: commercialBefore,
        credsPath: outPath,
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
