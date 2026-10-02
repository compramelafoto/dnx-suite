/**
 * ETAPA 11 — Extender Santa Fe en Foco: bases sfef-2026-bases-v3 + fechas nuevas.
 *
 * La organización extendió la recepción de obras hasta el 31/10/2026 inclusive,
 * la evaluación pasa a noviembre y la presentación de premios al 10/12/2026.
 *
 * En UNA transacción:
 * - Crea FotorankContestRulesVersion v3 PUBLISHED (no muta la anterior) y archiva la previa.
 * - Mueve las fechas del concurso: cierre exclusivo 1/11 00:00 ART para inscripción y
 *   carga, evaluación 1/11–30/11 y resultados 10/12 (las de evaluación/resultados son
 *   sólo informativas y se guardan al mediodía ART para que se lean igual en UTC).
 * - NO toca registrations / acceptances / entries: cada inscripto reacepta v3 con un clic
 *   antes de subir o reemplazar (registration/rules-reacceptance.ts).
 *
 *   SFEF_ALLOW_PRODUCTION_BASES_V3=1 \
 *   SFEF_INSTITUTIONAL_AUTH=1 \
 *   DATABASE_URL=...prod \
 *   pnpm --filter @repo/db exec tsx prisma/scripts/ops-sfef-11-extend-dates-bases-v3-production.ts
 *
 * Dry-run (solo auditoría):
 *   SFEF_BASES_V3_DRY_RUN=1 ...
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const basesV3 = require("../../../../apps/fotorank/app/lib/fotorank/rules-lifecycle/santa-fe-bases-v3.ts") as {
  SFEF_BASES_V3_TITLE: string;
  SFEF_BASES_V3_VERSION: string;
  buildSantaFeBasesV3Markdown: () => string;
};
const { SFEF_BASES_V3_TITLE, SFEF_BASES_V3_VERSION, buildSantaFeBasesV3Markdown } = basesV3;

const prisma = new PrismaClient();
const SLUG = "santa-fe-en-foco";

/** Cierre EXCLUSIVO: 1/11/2026 00:00 ART ⇒ el 31/10 entero sigue abierto. */
const NEW_CLOSE_EXCLUSIVE = new Date("2026-11-01T03:00:00.000Z");
/** Fechas informativas, al mediodía ART para que ningún huso las corra de día. */
const NEW_JUDGING_START = new Date("2026-11-01T15:00:00.000Z");
const NEW_JUDGING_END = new Date("2026-11-30T15:00:00.000Z");
const NEW_RESULTS = new Date("2026-12-10T15:00:00.000Z");

const NEW_DATES = {
  registrationClosesAt: NEW_CLOSE_EXCLUSIVE,
  submissionDeadline: NEW_CLOSE_EXCLUSIVE,
  judgingStartAt: NEW_JUDGING_START,
  judgingEndAt: NEW_JUDGING_END,
  resultsAt: NEW_RESULTS,
};

function normalize(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\s+$/u, "");
}

function hashContent(content: string): string {
  return createHash("sha256").update(normalize(content), "utf8").digest("hex");
}

function assertProd() {
  if (process.env.SFEF_ALLOW_PRODUCTION_BASES_V3 !== "1") {
    throw new Error("ABORT: SFEF_ALLOW_PRODUCTION_BASES_V3=1 requerido");
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
  const dryRun = process.env.SFEF_BASES_V3_DRY_RUN === "1";

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
      judgingStartAt: true,
      judgingEndAt: true,
      resultsAt: true,
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

  const content = normalize(buildSantaFeBasesV3Markdown());
  const contentHash = hashContent(content);

  const datesAlreadySet = (Object.keys(NEW_DATES) as (keyof typeof NEW_DATES)[]).every(
    (k) => contest[k]?.getTime() === NEW_DATES[k].getTime(),
  );

  if (published?.contentHash === contentHash && datesAlreadySet) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          noop: true,
          reason: "La versión PUBLISHED ya tiene el mismo contentHash y las fechas ya están movidas",
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
    throw new Error("ABORT: el texto v3 no debe contener aviso de carga cerrada");
  }
  if (!content.includes(SFEF_BASES_V3_VERSION)) {
    throw new Error("ABORT: falta identificador sfef-2026-bases-v3 en el contenido");
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
    stage: "ETAPA_11_EXTENSION_BASES_V3",
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
    dates: {
      before: {
        registrationClosesAt: contest.registrationClosesAt,
        submissionDeadline: contest.submissionDeadline,
        judgingStartAt: contest.judgingStartAt,
        judgingEndAt: contest.judgingEndAt,
        resultsAt: contest.resultsAt,
      },
      after: NEW_DATES,
    },
    basesAlreadyPublished: published?.contentHash === contentHash,
    newVersion: {
      humanId: SFEF_BASES_V3_VERSION,
      title: SFEF_BASES_V3_TITLE,
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
  const basesAlreadyPublished = published?.contentHash === contentHash;

  const publishedRow = await prisma.$transaction(async (tx) => {
    await tx.fotorankContest.update({
      where: { id: contest.id },
      data: {
        ...NEW_DATES,
        ...(basesAlreadyPublished ? {} : { rulesText: content }),
      },
    });

    if (basesAlreadyPublished) return published!;

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
        title: SFEF_BASES_V3_TITLE,
        content,
        contentHash,
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdByUserId: actor.id,
      },
    });

    await tx.fotorankContestRulesAuditEvent.create({
      data: {
        contestId: contest.id,
        rulesVersionId: row.id,
        actorUserId: actor.id,
        action: "PUBLISH_SFEF_BASES_V3",
        notes: `Publicación canónica ${SFEF_BASES_V3_VERSION} (extensión al 31/10, evaluación en noviembre, premiación 10/12). Archiva ${published?.id ?? "none"}.`,
        metadataJson: {
          previousRulesVersionId: published?.id ?? null,
          previousAcceptanceCount: acceptancesOnPublished,
          humanVersionId: SFEF_BASES_V3_VERSION,
          // Json no acepta Date: se serializan a ISO.
          previousDates: JSON.parse(JSON.stringify(audit.dates.before)),
          newDates: JSON.parse(JSON.stringify(NEW_DATES)),
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
  const historicalStillOnPrevious = published
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
        historicalStillOnPreviousVersion: historicalStillOnPrevious,
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
