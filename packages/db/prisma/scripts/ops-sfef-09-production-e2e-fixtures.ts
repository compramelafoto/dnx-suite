/**
 * Fixtures E2E Production ETAPA 09 — usuario sintético @fotorank.test
 *
 *   DATABASE_URL=...prod SFEF_ALLOW_PRODUCTION_E2E=1 \
 *     pnpm --filter @repo/db exec tsx ../../apps/fotorank/scripts/ops-sfef-09-production-e2e-fixtures.ts
 */
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PARTICIPANT_EMAIL = `sfef09-e2e-${Date.now()}@fotorank.test`;
const PARTICIPANT_PASSWORD = `Sfef09!${Math.random().toString(36).slice(2, 10)}A1`;
const CREDS_PATH = process.env.SFEF09_CREDS_PATH ?? "/tmp/sfef-09-e2e.env";

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function assertProd() {
  if (process.env.SFEF_ALLOW_PRODUCTION_E2E !== "1") {
    throw new Error("ABORT: SFEF_ALLOW_PRODUCTION_E2E=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url || /ep-round-fog|staging|localhost|127\.0\.0\.1/i.test(url)) {
    throw new Error("ABORT: DATABASE_URL no parece Production");
  }
}

async function main() {
  assertProd();

  const participant = await prisma.user.create({
    data: {
      email: PARTICIPANT_EMAIL,
      password: hashPassword(PARTICIPANT_PASSWORD),
      name: "SFEF09 E2E Participant",
      emailVerifiedAt: new Date(),
      role: "CUSTOMER",
    },
    select: { id: true, email: true },
  });

  const adminEmail = process.env.SFEF09_ADMIN_EMAIL?.trim() || "admin@fotorank.com";
  const adminPassword = process.env.SFEF09_ADMIN_PASSWORD?.trim() || "AdminSeed!e2e";
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, email: true },
  });

  const lines = [
    `SFEF09_PARTICIPANT_EMAIL=${participant.email}`,
    `SFEF09_PARTICIPANT_PASSWORD=${PARTICIPANT_PASSWORD}`,
    `SFEF09_PARTICIPANT_USER_ID=${participant.id}`,
    `SFEF09_ADMIN_EMAIL=${admin?.email ?? ""}`,
    `SFEF09_ADMIN_PASSWORD=${adminPassword}`,
    `SFEF09_CONTEST_SLUG=santa-fe-en-foco`,
  ];
  writeFileSync(CREDS_PATH, lines.join("\n") + "\n", { mode: 0o600 });

  console.log(
    JSON.stringify(
      {
        ok: true,
        credsPath: CREDS_PATH,
        participantEmail: participant.email,
        adminEmail: admin?.email ?? null,
        adminPasswordConfigured: Boolean(adminPassword),
        fixtureMarker: createHash("sha256").update(participant.email).digest("hex").slice(0, 12),
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
