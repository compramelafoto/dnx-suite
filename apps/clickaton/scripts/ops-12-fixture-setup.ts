/**
 * ETAPA 12 — fixture con reveal GLOBAL + ventanas captura/carga independientes.
 *
 *   SFEF12_ALLOW_PROD_FIXTURE=1 DATABASE_URL=... \
 *     pnpm --filter @repo/db exec tsx ../../apps/clickaton/scripts/ops-12-fixture-setup.ts
 */
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"));
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const PASSWORD = `Ck12-A-${randomBytes(3).toString("hex")}!`;

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) throw new Error("ABORT host");
  if (process.env.SFEF12_ALLOW_PROD_FIXTURE !== "1") throw new Error("ABORT flag");

  const prisma = new PrismaClient();
  const execId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  const slug = `clickaton-fr-12-fixture-${execId}`;

  const commercialBefore = {
    regs: await prisma.clickatonRegistration.count({ where: { editionId: COMMERCIAL_EDITION_ID } }),
    approved: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID, paymentStatus: "APPROVED" },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID, paymentOrderId: { not: null } },
    }),
  };

  const sa = await prisma.user.findUnique({
    where: { email: "cuart.daniel@gmail.com" },
    select: { id: true },
  });
  if (!sa) throw new Error("SA missing");

  const org = await prisma.contestOrganization.create({
    data: {
      name: `Ops Fixture Org 12 ${execId}`,
      slug: `ops-fixture-org-12-${execId}`,
      createdByUserId: sa.id,
      members: { create: { userId: sa.id, role: "OWNER", status: "ACTIVE" } },
    },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `Clickatón 12 Schedule Fixture ${execId}`,
      slug: `ck-fr-12-fixture-${execId}`,
      status: "PUBLISHED",
      visibility: "PRIVATE",
      experienceType: "MARATHON",
      distributionChannel: "CLICKATON",
      registrationEnabled: false,
      timezone: "America/Argentina/Buenos_Aires",
      createdByUserId: sa.id,
      categories: { create: { name: "General", slug: "general", status: "ACTIVE", sortOrder: 0 } },
    },
  });

  const now = new Date();
  // Ventanas aceleradas: reveal ahora-ish, captura 2h, upload 4h
  const revealAt = new Date(now.getTime() + 5 * 60_000);
  const captureStart = new Date(now.getTime() + 5 * 60_000);
  const captureEnd = new Date(now.getTime() + 120 * 60_000);
  const uploadStart = new Date(now.getTime() + 5 * 60_000);
  const uploadEnd = new Date(now.getTime() + 240 * 60_000);

  const edition = await prisma.clickatonEdition.create({
    data: {
      name: `CK 12 Fixture ${execId}`,
      slug,
      shortDescription: "OPS FIXTURE 12 — reveal global + ventanas",
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
      name: "Fixture 12",
      code: `FX12-${execId}`,
      priceAmount: 0,
      currency: "ARS",
      capacity: 20,
      isActive: true,
    },
  });

  const prompts = [];
  for (let i = 1; i <= 10; i++) {
    const p = await prisma.clickatonPrompt.create({
      data: {
        editionId: edition.id,
        sequence: i,
        internalName: `12 Prompt ${i}`,
        title: `Consigna ${i}`,
        instructions: `Instrucciones secretas 12 #${i}`,
        status: "LOCKED",
        releaseMode: "SCHEDULED",
        captureStartsAt: captureStart,
        captureEndsAt: captureEnd,
        uploadStartsAt: uploadStart,
        uploadEndsAt: uploadEnd,
        minEntries: 1,
        maxEntries: 1,
        allowReplacement: true,
        replacementDeadline: uploadEnd,
        gpsMode: "OPTIONAL",
        createdByUserId: sa.id,
      },
    });
    prompts.push(p);
  }

  const email = `clickaton12-${execId}-01@fotorank.test`;
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "CK12 Fixture",
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
      firstName: "CK12",
      lastName: "Fixture",
      ticketTypeId: ticket.id,
      status: "CONFIRMED",
      paymentStatus: "APPROVED",
      confirmedAt: now,
      acceptedTermsAt: now,
      acceptedImageAt: now,
      sequenceNumber: 1,
      visibleCode: `X2${execId.slice(-4).toUpperCase()}`,
      isOpsTest: false,
    },
  });

  const outPath = "/tmp/clickaton-12-fixture.env";
  writeFileSync(
    outPath,
    [
      `SFEF12_EXEC_ID=${execId}`,
      `SFEF12_PASSWORD=${PASSWORD}`,
      `SFEF12_EDITION_ID=${edition.id}`,
      `SFEF12_EDITION_SLUG=${edition.slug}`,
      `SFEF12_CONTEST_ID=${contest.id}`,
      `SFEF12_ORG_ID=${org.id}`,
      `SFEF12_TICKET_ID=${ticket.id}`,
      `SFEF12_REG_1=${reg.id}`,
      `SFEF12_USER_1_ID=${u.id}`,
      `SFEF12_USER_1_EMAIL=${u.email}`,
      `SFEF12_REVEAL_AT=${revealAt.toISOString()}`,
      `SFEF12_CAPTURE_START=${captureStart.toISOString()}`,
      `SFEF12_CAPTURE_END=${captureEnd.toISOString()}`,
      `SFEF12_UPLOAD_START=${uploadStart.toISOString()}`,
      `SFEF12_UPLOAD_END=${uploadEnd.toISOString()}`,
      `SFEF12_COMMERCIAL_REG_COUNT_BEFORE=${commercialBefore.regs}`,
      `SFEF12_COMMERCIAL_APPROVED_BEFORE=${commercialBefore.approved}`,
      `SFEF12_COMMERCIAL_PAID_BEFORE=${commercialBefore.paidOrders}`,
      ...prompts.map((p, i) => `SFEF12_PROMPT_${i + 1}=${p.id}`),
    ].join("\n") + "\n",
  );

  console.log(JSON.stringify({ ok: true, editionId: edition.id, contestId: contest.id, slug, credsPath: outPath, commercialBefore }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
