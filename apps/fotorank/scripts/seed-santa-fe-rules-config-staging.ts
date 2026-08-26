/**
 * Publica rules-config Santa Fe en staging (evita interop CJS del seed en @repo/db).
 * Uso (solo staging):
 *   DATABASE_URL=… DIRECT_URL=… NODE_ENV=development VERCEL_ENV=preview \
 *     pnpm --filter fotorank exec tsx scripts/seed-santa-fe-rules-config-staging.ts
 */
import { prisma } from "@repo/db";
import { buildSantaFeEnFoco2026Configuration } from "../app/lib/fotorank/rules-config/santa-fe-en-foco-2026";
import {
  ensureSystemProvincialTemplate,
  publishConfigurationVersion,
  saveDraftConfiguration,
} from "../app/lib/fotorank/rules-config/service";

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("seed-santa-fe-rules-config-staging bloqueado en producción");
  }
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  if (!host.includes("ep-round-fog") || host.includes("dawn-dew")) {
    throw new Error(`ABORT host no staging: ${host}`);
  }

  const admin =
    (await prisma.user.findUnique({ where: { email: "admin@fotorank.com" } })) ??
    (await prisma.user.findFirst({ orderBy: { id: "asc" } }));
  if (!admin) throw new Error("Sin usuarios");

  const contest = await prisma.fotorankContest.findFirst({ where: { slug: "santa-fe-en-foco" } });
  if (!contest) throw new Error("Concurso santa-fe-en-foco no existe");

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

  console.log(
    JSON.stringify(
      {
        ok: true,
        host,
        contestId: contest.id,
        configVersionId: draft.id,
        versionNumber: draft.versionNumber,
        hash: published.hash,
        validation: draft.validation.status,
        residencyRequired: config.participation.residencyRequired,
        categories: config.categories.map((c) => c.slug),
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
