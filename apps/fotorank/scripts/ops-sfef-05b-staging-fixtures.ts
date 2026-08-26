/**
 * Fixtures únicos por ejecución para E2E ETAPA 05B (solo staging round-fog).
 * No usa participantes reales ni ARGRA reales.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@repo/db";

const KEY_LEN = 64;
const PASSWORD = "Sfef05b-Test-Only!";

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
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("ABORT production");
  }
}

async function main() {
  assertStaging();
  const runId = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const users = [
    { key: "open_other_province", email: `sfef05b-open-${runId}@fotorank.test`, province: "Córdoba" },
    { key: "amateur", email: `sfef05b-amateur-${runId}@fotorank.test`, province: "Buenos Aires" },
    { key: "professional", email: `sfef05b-pro-${runId}@fotorank.test`, province: "Mendoza" },
    { key: "reporter", email: `sfef05b-argra-${runId}@fotorank.test`, province: "Entre Ríos" },
    { key: "aerial", email: `sfef05b-aerial-${runId}@fotorank.test`, province: "Salta" },
    { key: "limits", email: `sfef05b-limits-${runId}@fotorank.test`, province: "Chaco" },
  ] as const;

  const created: Array<{ key: string; email: string; id: number; province: string }> = [];
  for (const u of users) {
    const row = await prisma.user.create({
      data: {
        email: u.email,
        name: `SFEF05B ${u.key}`,
        password: hashPassword(PASSWORD),
        province: u.province,
        country: "Argentina",
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true },
    });
    created.push({ key: u.key, email: row.email, id: row.id, province: u.province });
  }

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: "santa-fe-en-foco" },
    include: { categories: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } },
  });
  if (!contest) throw new Error("Contest missing");

  const out = {
    ok: true,
    runId,
    password: PASSWORD,
    baseUrl: process.env.PLAYWRIGHT_BASE_URL ?? "https://fotorank.staging.dnxsuite.com",
    contestId: contest.id,
    categories: Object.fromEntries(contest.categories.map((c) => [c.slug, c.id])),
    users: Object.fromEntries(created.map((u) => [u.key, { email: u.email, id: u.id, province: u.province }])),
  };
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
