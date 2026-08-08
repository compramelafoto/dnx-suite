/**
 * ETAPA 11D — setup edición fixture NO pública + contest FR + 3 prompts + users.
 *
 *   SFEF11D_ALLOW_PROD_FIXTURE=1 DATABASE_URL=... \
 *     pnpm --filter @repo/db exec tsx ../../apps/clickaton/scripts/ops-11d-fixture-setup.ts
 *
 * Creds → /tmp/clickaton-11d-fixture.env
 */
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const KEY_LEN = 64;
const PASSWORD = `Ck11d-A-${randomBytes(3).toString("hex")}!`;
const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${digest}`;
}

function assertProdFixtureAllowed() {
  const url = process.env.DATABASE_URL ?? "";
  const host = new URL(url).hostname;
  if (!host.includes("ep-dawn-dew")) {
    throw new Error(`ABORT host inesperado: ${host}. 11D espera dawn-dew.`);
  }
  if (process.env.SFEF11D_ALLOW_PROD_FIXTURE !== "1") {
    throw new Error("ABORT: SFEF11D_ALLOW_PROD_FIXTURE=1 requerido");
  }
}

async function main() {
  assertProdFixtureAllowed();
  const prisma = new PrismaClient();
  const execId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  const slug = `clickaton-fr-assets-fixture-${execId}`;
  const titles = ["Forma", "Movimiento", "Contraste"] as const;

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
      name: `Ops Fixture Org 11D ${execId}`,
      slug: `ops-fixture-org-11d-${execId}`,
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
      title: `Clickatón FR Assets Fixture ${execId}`,
      slug: `ck-fr-assets-fixture-${execId}`,
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
      name: `CK FR Assets Fixture ${execId}`,
      slug,
      shortDescription: "OPS FIXTURE — no comercial / no pública",
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
      name: "Fixture Ticket",
      code: `FX-${execId}`,
      priceAmount: 0,
      currency: "ARS",
      capacity: 50,
      isActive: true,
    },
  });

  const now = new Date();
  const prompts = [];
  for (let i = 1; i <= 3; i++) {
    const revealOffsetMin = (i - 1) * 2;
    const closeOffsetMin = 10 + (i - 1) * 2;
    const revealAt = new Date(now.getTime() + revealOffsetMin * 60_000 - (i === 1 ? 120_000 : 0));
    const closeAt = new Date(now.getTime() + closeOffsetMin * 60_000);
    const p = await prisma.clickatonPrompt.create({
      data: {
        editionId: edition.id,
        sequence: i,
        internalName: `Fixture Prompt ${i}`,
        title: titles[i - 1]!,
        instructions: `Consigna sintética ${i}: ${titles[i - 1]}`,
        status: i === 1 ? "RELEASED" : "LOCKED",
        releaseMode: "SCHEDULED",
        captureStartsAt: revealAt,
        captureEndsAt: closeAt,
        uploadStartsAt: revealAt,
        uploadEndsAt: closeAt,
        minEntries: 1,
        maxEntries: 1,
        allowReplacement: true,
        gpsMode: "OPTIONAL",
        createdByUserId: sa.id,
        releasedAt: i === 1 ? now : null,
        releasedByUserId: i === 1 ? sa.id : null,
      },
    });
    prompts.push(p);
  }

  const users = [];
  for (let i = 1; i <= 2; i++) {
    const email = `clickaton11d-${execId}-0${i}@fotorank.test`;
    const u = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: `CK11D Fixture ${i}`,
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
        firstName: "CK11D",
        lastName: `Fixture${i}`,
        ticketTypeId: ticket.id,
        status: "CONFIRMED",
        // Pago sintético ops: APPROVED sin orden/transacción real (sync POST_PAID).
        paymentStatus: "APPROVED",
        confirmedAt: now,
        acceptedTermsAt: now,
        acceptedImageAt: now,
        sequenceNumber: i,
        visibleCode: `FX${execId.slice(-4).toUpperCase()}${i}`,
      },
    });
    users.push({ ...u, registrationId: reg.id });
  }

  const outPath = "/tmp/clickaton-11d-fixture.env";
  writeFileSync(
    outPath,
    [
      `SFEF11D_EXEC_ID=${execId}`,
      `SFEF11D_PASSWORD=${PASSWORD}`,
      `SFEF11D_EDITION_ID=${edition.id}`,
      `SFEF11D_EDITION_SLUG=${edition.slug}`,
      `SFEF11D_CONTEST_ID=${contest.id}`,
      `SFEF11D_ORG_ID=${org.id}`,
      `SFEF11D_TICKET_ID=${ticket.id}`,
      `SFEF11D_PROMPT_1=${prompts[0]!.id}`,
      `SFEF11D_PROMPT_2=${prompts[1]!.id}`,
      `SFEF11D_PROMPT_3=${prompts[2]!.id}`,
      `SFEF11D_USER_1_EMAIL=${users[0]!.email}`,
      `SFEF11D_USER_1_ID=${users[0]!.id}`,
      `SFEF11D_REG_1=${users[0]!.registrationId}`,
      `SFEF11D_USER_2_EMAIL=${users[1]!.email}`,
      `SFEF11D_USER_2_ID=${users[1]!.id}`,
      `SFEF11D_REG_2=${users[1]!.registrationId}`,
      `SFEF11D_COMMERCIAL_EDITION_ID=${COMMERCIAL_EDITION_ID}`,
      `SFEF11D_COMMERCIAL_REG_COUNT_BEFORE=${commercialBefore}`,
      `SFEF11D_COMMERCIAL_APPROVED_COUNT_BEFORE=${commercialApprovedBefore}`,
      `SFEF11D_COMMERCIAL_PAID_ORDERS_BEFORE=${commercialPaidOrdersBefore}`,
    ].join("\n") + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        execId,
        editionId: edition.id,
        contestId: contest.id,
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
