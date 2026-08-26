/**
 * Aplica configuración estructurada Santa Fe en Foco 2026 al concurso seed.
 *
 * DATABASE_URL=...staging \
 *   pnpm --filter @repo/db exec tsx prisma/scripts/seed-santa-fe-rules-config.ts
 */
import { prisma } from "../../src/client.js";
import { buildSantaFeEnFoco2026Configuration } from "../../../../apps/fotorank/app/lib/fotorank/rules-config/santa-fe-en-foco-2026.ts";
import {
  saveDraftConfiguration,
  publishConfigurationVersion,
  ensureSystemProvincialTemplate,
} from "../../../../apps/fotorank/app/lib/fotorank/rules-config/service.ts";

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("seed-santa-fe-rules-config bloqueado en producción");
  }

  const admin =
    (await prisma.user.findUnique({ where: { email: "admin@fotorank.com" } })) ??
    (await prisma.user.findFirst({ orderBy: { id: "asc" } }));
  if (!admin) throw new Error("Sin usuarios — correr seed-bootstrap-admin");

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: "santa-fe-en-foco" },
  });
  if (!contest) throw new Error("Concurso santa-fe-en-foco no existe — correr seed-santa-fe-en-foco");

  const config = buildSantaFeEnFoco2026Configuration();
  const draft = await saveDraftConfiguration({
    contestId: contest.id,
    config,
    createdByUserId: admin.id,
  });

  const published = await publishConfigurationVersion({
    contestId: contest.id,
    versionId: draft.id,
    actorUserId: admin.id,
    allowPendingHuman: true,
  });

  await ensureSystemProvincialTemplate(admin.id);

  console.log("[seed-santa-fe-rules-config] OK");
  console.log(`  contest: ${contest.id}`);
  console.log(`  configVersion: ${draft.id} v${draft.versionNumber}`);
  console.log(`  hash: ${published.hash}`);
  console.log(`  validation draft: ${draft.validation.status}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
