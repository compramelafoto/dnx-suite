/**
 * Carga idempotente de premios monetarios — Santa Fe en Foco (producción).
 *
 * Solo muta `FotorankContest.rulesData.premiosRecompensas.prizes` del concurso
 * validado por slug + ID. No toca categorías, bases, jurados, resultados ni ganadores.
 *
 * Diagnóstico (dry-run, sin escribir):
 *   SFEF_ALLOW_PRODUCTION_PRIZES=1 \
 *   SFEF_INSTITUTIONAL_AUTH=1 \
 *   SFEF_PRIZES_DRY_RUN=1 \
 *   DATABASE_URL=...prod \
 *   pnpm --filter @repo/db exec tsx prisma/scripts/ops-sfef-configure-prizes-production.ts
 *
 * Apply:
 *   SFEF_ALLOW_PRODUCTION_PRIZES=1 \
 *   SFEF_INSTITUTIONAL_AUTH=1 \
 *   DATABASE_URL=...prod \
 *   pnpm --filter @repo/db exec tsx prisma/scripts/ops-sfef-configure-prizes-production.ts \
 *     --confirm-fotorank-production-prizes
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  SFEF_CONTEST_ID,
  SFEF_SLUG,
  mergePremiosRecompensas,
  resolveSfefCategories,
  upsertSfefPrizes,
  type SfefPrizeItem,
} from "./lib/sfef-configure-prizes.ts";

const prisma = new PrismaClient();
const ALLOWED_HOST = "ep-dawn-dew";

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function assertProdGuards() {
  if (process.env.SFEF_ALLOW_PRODUCTION_PRIZES !== "1") {
    throw new Error("ABORT: SFEF_ALLOW_PRODUCTION_PRIZES=1 requerido");
  }
  if (process.env.SFEF_INSTITUTIONAL_AUTH !== "1") {
    throw new Error("ABORT: SFEF_INSTITUTIONAL_AUTH=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("ABORT: DATABASE_URL ausente");
  if (/ep-round-fog|staging|localhost|127\.0\.0\.1|fotorank_staging|silent-haze/i.test(url)) {
    throw new Error("ABORT: DATABASE_URL parece staging/local");
  }
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("ABORT: DATABASE_URL inválida");
  }
  if (!host.includes(ALLOWED_HOST)) {
    throw new Error(`ABORT: host no permitido (esperado ${ALLOWED_HOST})`);
  }
  return { hostHint: host.slice(0, 40) };
}

function snapshotPaths(stamp: string) {
  const fileName = `sfef-prizes-backup-${stamp}.json`;
  const tmpDir = "/tmp/fotorank-prod-backups";
  const dataDir = join(process.cwd(), "../../.data/fotorank-prod-backups");
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  return {
    tmp: join(tmpDir, fileName),
    data: join(dataDir, fileName),
  };
}

function summarizePrizes(prizes: SfefPrizeItem[]) {
  return prizes.map((p) => ({
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    positionLabel: p.positionLabel,
    amount: p.amount,
    currency: p.currency,
    visiblePublic: p.visiblePublic,
    deliveryStatus: p.deliveryStatus,
  }));
}

async function main() {
  const { hostHint } = assertProdGuards();
  const dryRun = process.env.SFEF_PRIZES_DRY_RUN === "1" || hasFlag("--dry-run");
  const confirmed = hasFlag("--confirm-fotorank-production-prizes");
  if (!dryRun && !confirmed) {
    console.log(
      JSON.stringify(
        {
          status: "SKIPPED",
          reason: "missing_confirm",
          hint: "Usá SFEF_PRIZES_DRY_RUN=1 o --confirm-fotorank-production-prizes",
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: SFEF_SLUG },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      visibility: true,
      rulesData: true,
      prizesSummary: true,
      resultsAt: true,
      judgingStartAt: true,
      judgingEndAt: true,
      updatedAt: true,
      categories: {
        select: { id: true, slug: true, name: true, status: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!contest) {
    throw new Error(`ABORT: concurso slug=${SFEF_SLUG} no encontrado`);
  }
  if (contest.id !== SFEF_CONTEST_ID) {
    throw new Error(
      `ABORT: ID mismatch — slug=${SFEF_SLUG} id=${contest.id} expected=${SFEF_CONTEST_ID}`,
    );
  }

  const otherSlugCheck = await prisma.fotorankContest.findUnique({
    where: { id: SFEF_CONTEST_ID },
    select: { id: true, slug: true },
  });
  if (!otherSlugCheck || otherSlugCheck.slug !== SFEF_SLUG) {
    throw new Error("ABORT: guard cruzado id→slug falló");
  }

  const resolved = resolveSfefCategories(contest.categories);
  if (!resolved.ok) {
    throw new Error(`ABORT: faltan categorías ${resolved.missingSlugs.join(", ")}`);
  }

  const prevModule =
    contest.rulesData &&
    typeof contest.rulesData === "object" &&
    !Array.isArray(contest.rulesData) &&
    (contest.rulesData as { premiosRecompensas?: { prizes?: unknown[] } }).premiosRecompensas
      ? (contest.rulesData as { premiosRecompensas: { prizes?: unknown[] } }).premiosRecompensas
      : { prizes: [] };

  const beforePrizes = Array.isArray(prevModule.prizes) ? prevModule.prizes : [];
  const plan = upsertSfefPrizes({
    existingPrizes: beforePrizes,
    categories: resolved.categories,
  });

  if (!plan.validation.ok) {
    console.log(
      JSON.stringify(
        {
          status: "BLOCKED",
          reason: "validation_failed",
          errors: plan.validation.errors,
          changes: plan.changes,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const paths = snapshotPaths(stamp);
  const backupPayload = {
    stage: "SFEF_CONFIGURE_PRIZES",
    createdAt: new Date().toISOString(),
    hostHint,
    contest: {
      id: contest.id,
      slug: contest.slug,
      title: contest.title,
      updatedAt: contest.updatedAt,
      prizesSummary: contest.prizesSummary,
      resultsAt: contest.resultsAt,
      judgingStartAt: contest.judgingStartAt,
      judgingEndAt: contest.judgingEndAt,
    },
    categories: contest.categories,
    rulesDataBefore: contest.rulesData,
  };
  writeFileSync(paths.tmp, JSON.stringify(backupPayload, null, 2));
  writeFileSync(paths.data, JSON.stringify(backupPayload, null, 2));

  const nextRulesData = mergePremiosRecompensas(contest.rulesData, plan.prizes);
  const changeSummary = {
    create: plan.changes.filter((c) => c.action === "create").length,
    update: plan.changes.filter((c) => c.action === "update").length,
    keep: plan.changes.filter((c) => c.action === "keep").length,
    remove_duplicate: plan.changes.filter((c) => c.action === "remove_duplicate").length,
  };

  const diagnosis = {
    status: dryRun ? "DRY_RUN" : "APPLY",
    stage: "SFEF_CONFIGURE_PRIZES",
    hostHint,
    contest: {
      id: contest.id,
      title: contest.title,
      slug: contest.slug,
      status: contest.status,
      visibility: contest.visibility,
    },
    categories: resolved.categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      status: c.status,
    })),
    before: {
      prizesCount: beforePrizes.length,
      prizes: beforePrizes,
    },
    changeSummary,
    changes: plan.changes.map((c) => ({
      action: c.action,
      prizeId: c.prizeId,
      categorySlug: c.categorySlug,
      place: c.place,
      reason: c.reason,
      afterAmount: c.after?.amount,
    })),
    afterPlan: {
      prizesCount: plan.prizes.length,
      prizes: summarizePrizes(plan.prizes),
      perCategory: plan.validation.perCategory,
      grandTotal: plan.validation.grandTotal,
    },
    untouchedGuards: {
      categoriesNotModified: true,
      resultsAt: contest.resultsAt,
      judgingStartAt: contest.judgingStartAt,
      judgingEndAt: contest.judgingEndAt,
      noWinnersAssigned: plan.prizes.every((p) => p.deliveryStatus === "PENDING" && !p.winnerLabel),
    },
    backup: paths,
  };

  if (dryRun) {
    console.log(JSON.stringify({ ...diagnosis, wrote: false }, null, 2));
    return;
  }

  const updated = await prisma.fotorankContest.update({
    where: { id: contest.id },
    data: { rulesData: nextRulesData },
    select: {
      id: true,
      slug: true,
      rulesData: true,
      updatedAt: true,
      resultsAt: true,
      judgingStartAt: true,
      judgingEndAt: true,
    },
  });

  // Post-write verification (solo este concurso).
  const verifyModule =
    updated.rulesData &&
    typeof updated.rulesData === "object" &&
    !Array.isArray(updated.rulesData)
      ? (updated.rulesData as { premiosRecompensas?: { prizes?: unknown[] } }).premiosRecompensas
      : undefined;
  const verifyPrizes = Array.isArray(verifyModule?.prizes) ? verifyModule!.prizes! : [];
  const verify = upsertSfefPrizes({
    existingPrizes: verifyPrizes,
    categories: resolved.categories,
  });

  const otherContestsTouched = await prisma.fotorankContest.count({
    where: {
      id: { not: contest.id },
      updatedAt: { gt: new Date(Date.now() - 60_000) },
    },
  });

  console.log(
    JSON.stringify(
      {
        ...diagnosis,
        wrote: true,
        updatedAt: updated.updatedAt,
        verify: {
          ok: verify.validation.ok && verify.changes.every((c) => c.action === "keep"),
          prizesCount: verifyPrizes.length,
          grandTotal: verify.validation.grandTotal,
          perCategory: verify.validation.perCategory,
          keepCount: verify.changes.filter((c) => c.action === "keep").length,
        },
        otherContestsUpdatedLastMinute: otherContestsTouched,
        resultsUnchanged:
          String(updated.resultsAt) === String(contest.resultsAt) &&
          String(updated.judgingStartAt) === String(contest.judgingStartAt) &&
          String(updated.judgingEndAt) === String(contest.judgingEndAt),
      },
      null,
      2,
    ),
  );

  if (!verify.validation.ok || !verify.changes.every((c) => c.action === "keep")) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(
      JSON.stringify({ status: "FAILED", message: String(e?.message ?? e).slice(0, 600) }, null, 2),
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
