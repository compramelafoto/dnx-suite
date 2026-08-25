/**
 * Verifica que el seed de "El País que Miramos" no toque otros concursos.
 *
 * Crea dos concursos ajenos que imitan a Clickatón y a Santa Fe en Foco,
 * ejecuta el seed dos veces y comprueba que ninguna de sus filas cambió.
 * Al final borra únicamente lo que creó.
 *
 * REQUIERE base de datos local aislada.
 * Uso: pnpm --filter fotorank test:seed:isolation
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { prisma } from "@repo/db";

import { assertSafeFotoRankDatabaseUrl } from "./assert-safe-database-url";
import {
  CONTEST_SLUG,
  ORGANIZATION_SLUG,
} from "../app/lib/fotorank/upcoming/contests/el-pais-que-miramos/definition";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(HERE, "seed-el-pais-que-miramos.ts");

const FIXTURES = [
  { orgSlug: "isolation-clickaton-org", contestSlug: "isolation-clickaton", title: "Clickatón (fixture)" },
  { orgSlug: "isolation-sfef-org", contestSlug: "isolation-santa-fe-en-foco", title: "Santa Fe en Foco (fixture)" },
];

/** Huella de las columnas que el seed podría llegar a tocar. */
function fingerprint(row: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(row), "utf8").digest("hex");
}

async function snapshotForeignContests(ids: string[]) {
  const rows = await prisma.fotorankContest.findMany({
    where: { id: { in: ids } },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({ id: r.id, hash: fingerprint(r as unknown as Record<string, unknown>) }));
}

function runSeed() {
  execFileSync("npx", ["tsx", SEED_PATH], {
    stdio: "pipe",
    env: process.env,
    cwd: resolve(HERE, "../../../packages/db"),
  });
}

async function main() {
  const check = assertSafeFotoRankDatabaseUrl();
  console.log(`Base verificada: ${check.host}/${check.database}`);

  const owner = await prisma.user.findFirst({ orderBy: { id: "asc" } });
  if (!owner) throw new Error("No hay usuarios en la base.");

  const createdOrgIds: string[] = [];
  const createdContestIds: string[] = [];

  try {
    // Concursos ajenos, en un estado publicado que el seed no debe alterar.
    for (const f of FIXTURES) {
      const org = await prisma.contestOrganization.create({
        data: { name: f.title, slug: f.orgSlug, createdByUserId: owner.id },
      });
      createdOrgIds.push(org.id);
      const contest = await prisma.fotorankContest.create({
        data: {
          organizationId: org.id,
          slug: f.contestSlug,
          title: f.title,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          registrationEnabled: true,
          createdByUserId: owner.id,
        },
      });
      createdContestIds.push(contest.id);
    }

    const before = await snapshotForeignContests(createdContestIds);
    const countBefore = await prisma.fotorankContest.count();

    runSeed();
    const countAfterFirst = await prisma.fotorankContest.count();
    runSeed();
    const countAfterSecond = await prisma.fotorankContest.count();

    // El seed agrega como mucho un concurso, y sólo la primera vez.
    assert.ok(
      countAfterFirst - countBefore <= 1,
      "el seed no debe crear más de un concurso",
    );
    assert.equal(
      countAfterSecond,
      countAfterFirst,
      "ejecutar el seed dos veces no debe duplicar el concurso",
    );

    // Ninguna fila ajena cambió.
    const after = await snapshotForeignContests(createdContestIds);
    assert.deepEqual(after, before, "el seed no debe modificar otros concursos");

    // El concurso propio quedó en DRAFT.
    const org = await prisma.contestOrganization.findUnique({
      where: { slug: ORGANIZATION_SLUG },
      select: { id: true },
    });
    assert.ok(org, "el seed debe dejar creada la organización FotoRank");
    const seeded = await prisma.fotorankContest.findUnique({
      where: { organizationId_slug: { organizationId: org.id, slug: CONTEST_SLUG } },
      select: { status: true, visibility: true, registrationEnabled: true },
    });
    assert.ok(seeded, "el concurso debe existir");
    assert.equal(seeded.status, "DRAFT", "el concurso debe quedar en DRAFT");
    assert.equal(seeded.visibility, "PRIVATE");
    assert.equal(seeded.registrationEnabled, false);

    // Y no creó datos ficticios de ningún tipo.
    const seededContest = await prisma.fotorankContest.findFirst({
      where: { slug: CONTEST_SLUG },
      select: { id: true },
    });
    const contestId = seededContest!.id;
    assert.equal(await prisma.fotorankContestInterest.count({ where: { contestId } }), 0);
    assert.equal(await prisma.fotorankContestParticipant.count({ where: { contestId } }), 0);
    assert.equal(await prisma.fotorankContestRegistration.count({ where: { contestId } }), 0);
    assert.equal(await prisma.fotorankJudgeAssignment.count({ where: { contestId } }), 0);

    console.log("seed-el-pais-que-miramos.isolation.selfcheck.ts OK");
  } finally {
    await prisma.fotorankContest.deleteMany({ where: { id: { in: createdContestIds } } });
    await prisma.contestOrganization.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
