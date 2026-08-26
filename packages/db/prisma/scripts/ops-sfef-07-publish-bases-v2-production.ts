/**
 * ETAPA 07 — Publicar Bases oficiales sfef-2026-bases-v2 en Production.
 *
 * - Crea nueva FotorankContestRulesVersion PUBLISHED (no muta la anterior).
 * - Archiva la PUBLISHED previa (solo status).
 * - NO toca registrations / acceptances / entries / users / storage.
 * - Sincroniza rulesText espejo + startAt / prizesSummary para coherencia pública.
 *
 *   SFEF_ALLOW_PRODUCTION_BASES_V2=1 \
 *   SFEF_INSTITUTIONAL_AUTH=1 \
 *   DATABASE_URL=...prod \
 *   pnpm --filter @repo/db exec tsx prisma/scripts/ops-sfef-07-publish-bases-v2-production.ts
 *
 * Dry-run (solo auditoría):
 *   SFEF_BASES_V2_DRY_RUN=1 ...
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const basesV2 = require("../../../../apps/fotorank/app/lib/fotorank/rules-lifecycle/santa-fe-bases-v2.ts") as {
  SFEF_BASES_V2_TITLE: string;
  SFEF_BASES_V2_VERSION: string;
  buildSantaFeBasesV2Markdown: () => string;
};
const { SFEF_BASES_V2_TITLE, SFEF_BASES_V2_VERSION, buildSantaFeBasesV2Markdown } = basesV2;

const prisma = new PrismaClient();
const SLUG = "santa-fe-en-foco";

function normalize(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\s+$/u, "");
}

function hashContent(content: string): string {
  return createHash("sha256").update(normalize(content), "utf8").digest("hex");
}

function assertProd() {
  if (process.env.SFEF_ALLOW_PRODUCTION_BASES_V2 !== "1") {
    throw new Error("ABORT: SFEF_ALLOW_PRODUCTION_BASES_V2=1 requerido");
  }
  if (process.env.SFEF_INSTITUTIONAL_AUTH !== "1") {
    throw new Error("ABORT: SFEF_INSTITUTIONAL_AUTH=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("ABORT: DATABASE_URL ausente");
  if (/ep-round-fog|staging|localhost|127\.0\.0\.1|fotorank_staging/i.test(url)) {
    throw new Error("ABORT: DATABASE_URL parece staging/local");
  }
}

async function main() {
  assertProd();
  const dryRun = process.env.SFEF_BASES_V2_DRY_RUN === "1";

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: SLUG },
    select: {
      id: true,
      title: true,
      slug: true,
      startAt: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      submissionOpensAt: true,
      submissionDeadline: true,
      prizesSummary: true,
      uploadPolicyJson: true,
      createdByUserId: true,
    },
  });
  if (!contest) throw new Error(`ABORT: concurso ${SLUG} no encontrado`);

  const versions = await prisma.fotorankContestRulesVersion.findMany({
    where: { contestId: contest.id },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      title: true,
      status: true,
      contentHash: true,
      publishedAt: true,
      _count: { select: { registrations: true } },
    },
  });

  const published = versions.find((v) => v.status === "PUBLISHED");
  const acceptancesOnPublished = published?._count.registrations ?? 0;
  const totalRegs = await prisma.fotorankContestRegistration.count({
    where: { contestId: contest.id },
  });

  const content = normalize(buildSantaFeBasesV2Markdown());
  const contentHash = hashContent(content);

  if (published?.contentHash === contentHash) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          noop: true,
          reason: "La versión PUBLISHED ya tiene el mismo contentHash",
          published,
          contentHash,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (content.includes("permanece cerrada")) {
    throw new Error("ABORT: el texto v2 no debe contener aviso de carga cerrada");
  }
  if (!content.includes(SFEF_BASES_V2_VERSION)) {
    throw new Error("ABORT: falta identificador sfef-2026-bases-v2 en el contenido");
  }
  if (!content.includes("todas las fotografías válidamente presentadas")) {
    throw new Error("ABORT: falta cláusula de licencia sobre todas las fotografías");
  }

  const actor =
    (await prisma.user.findUnique({
      where: { email: "admin@fotorank.com" },
      select: { id: true },
    })) ??
    (contest.createdByUserId
      ? { id: contest.createdByUserId }
      : await prisma.user.findFirst({ orderBy: { id: "asc" }, select: { id: true } }));
  if (!actor) throw new Error("ABORT: no hay actor user para createdByUserId");

  const audit = {
    stage: "ETAPA_07_BASES_V2",
    dryRun,
    contestId: contest.id,
    slug: SLUG,
    previousPublished: published
      ? {
          id: published.id,
          versionNumber: published.versionNumber,
          title: published.title,
          contentHash: published.contentHash,
          acceptanceCount: acceptancesOnPublished,
        }
      : null,
    totalRegistrations: totalRegs,
    uploadPolicy: contest.uploadPolicyJson,
    newVersion: {
      humanId: SFEF_BASES_V2_VERSION,
      title: SFEF_BASES_V2_TITLE,
      contentHash,
      contentLength: content.length,
    },
    safety: {
      willArchivePreviousPublished: Boolean(published),
      willMutatePreviousContent: false,
      willTouchRegistrations: false,
      willAutoAccept: false,
      historicalAcceptancesPreserved: acceptancesOnPublished,
    },
  };

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, ...audit }, null, 2));
    return;
  }

  const nextVersion = (versions[0]?.versionNumber ?? 0) + 1;
  const opens = new Date("2026-08-01T03:00:00.000Z");

  const publishedRow = await prisma.$transaction(async (tx) => {
    if (published) {
      await tx.fotorankContestRulesVersion.update({
        where: { id: published.id },
        data: { status: "ARCHIVED" },
      });
    }

    const row = await tx.fotorankContestRulesVersion.create({
      data: {
        contestId: contest.id,
        versionNumber: nextVersion,
        title: SFEF_BASES_V2_TITLE,
        content,
        contentHash,
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdByUserId: actor.id,
      },
    });

    await tx.fotorankContest.update({
      where: { id: contest.id },
      data: {
        rulesText: content,
        // Alinea overview/cronograma público (sin tocar ventanas de upload ya abiertas).
        startAt: opens,
        prizesSummary:
          "Por cada categoría: 1.º Premio $500.000 · 2.º Premio $400.000 · 3.º Premio $300.000. Menciones especiales opcionales a criterio del jurado.",
      },
    });

    await tx.fotorankContestRulesAuditEvent.create({
      data: {
        contestId: contest.id,
        rulesVersionId: row.id,
        actorUserId: actor.id,
        action: "PUBLISH_SFEF_BASES_V2",
        notes: `Publicación canónica ${SFEF_BASES_V2_VERSION}. Archiva ${published?.id ?? "none"}.`,
        metadataJson: {
          previousRulesVersionId: published?.id ?? null,
          previousAcceptanceCount: acceptancesOnPublished,
          humanVersionId: SFEF_BASES_V2_VERSION,
        },
      },
    });

    return row;
  });

  const afterAcceptances = await prisma.fotorankContestRegistration.groupBy({
    by: ["rulesVersionId"],
    where: { contestId: contest.id },
    _count: true,
  });
  const historicalStillOnV1 = published
    ? await prisma.fotorankContestRegistration.count({
        where: { contestId: contest.id, rulesVersionId: published.id },
      })
    : 0;

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...audit,
        published: {
          id: publishedRow.id,
          versionNumber: publishedRow.versionNumber,
          title: publishedRow.title,
          contentHash: publishedRow.contentHash,
          status: publishedRow.status,
        },
        afterAcceptances,
        historicalStillOnPreviousVersion: historicalStillOnV1,
        note: "Participantes existentes deben reaceptar expresamente; no se generaron aceptaciones automáticas.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
