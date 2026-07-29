/**
 * Validación de configuración de apertura — Santa Fe en Foco / P0-08b.
 *
 * DATABASE_URL=...staging pnpm --filter fotorank run contest:validate-launch-config
 *
 * Exit 0 solo si no hay bloqueadores. SKIP de R2/email cuenta como bloqueador
 * salvo excepciones documentadas vía env (no para GO productivo).
 */
import { prisma } from "@repo/db";
import { assertSafeFotoRankDatabaseUrl } from "../../../../scripts/assert-safe-database-url";
import { contentContainsPlaceholder, RULES_PLACEHOLDER_MARKER } from "../registration/rules-hash";
import { evaluatePlaceholderGate } from "./placeholder-gate";
import { isR2PrivateStorageConfigured } from "../storage/r2-private-storage";
import { resolvePrivateStorageProviderName } from "../storage/provider";

const SLUG = process.env.FOTORANK_LAUNCH_CONTEST_SLUG?.trim() || "santa-fe-en-foco";

const PLACEHOLDER_RES: RegExp[] = [
  /BORRADOR/i,
  /REEMPLAZAR/i,
  /VALIDAR/i,
  /\bTODO\b/,
  /PENDIENTE/i,
  new RegExp(RULES_PLACEHOLDER_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
];

type Finding = {
  id: string;
  severity: "blocker" | "warning";
  message: string;
};

function hasEmailProvider(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() || process.env.FOTORANK_SMTP_URL?.trim());
}

async function main() {
  const db = assertSafeFotoRankDatabaseUrl();
  const findings: Finding[] = [];

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: SLUG },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      categories: { where: { status: "ACTIVE" }, select: { id: true, name: true, slug: true, maxFiles: true } },
      rulesVersions: { orderBy: { versionNumber: "desc" }, take: 5 },
    },
  });

  if (!contest) {
    findings.push({ id: "contest_missing", severity: "blocker", message: `No existe concurso slug=${SLUG}` });
  } else {
    if (contest.registrationPricingMode !== "FREE") {
      findings.push({ id: "not_free", severity: "blocker", message: "Modalidad no es FREE" });
    }
    if ((contest.registrationPriceAmountMinor ?? 0) !== 0) {
      findings.push({ id: "price_nonzero", severity: "blocker", message: "Precio != 0" });
    }
    if ((contest.platformFeeBps ?? 0) !== 0) {
      findings.push({ id: "fee_nonzero", severity: "blocker", message: "platformFeeBps != 0" });
    }
    if (!contest.timezone?.trim()) {
      findings.push({ id: "timezone", severity: "blocker", message: "Timezone ausente" });
    }
    if (!contest.registrationOpensAt || !contest.registrationClosesAt) {
      findings.push({ id: "reg_windows", severity: "blocker", message: "Ventanas de inscripción incompletas" });
    } else if (contest.registrationOpensAt >= contest.registrationClosesAt) {
      findings.push({ id: "reg_order", severity: "blocker", message: "Apertura ≥ cierre inscripción" });
    }
    if (!contest.submissionDeadline) {
      findings.push({ id: "submission_deadline", severity: "blocker", message: "Cierre de carga ausente" });
    }
    if (!contest.categories.length) {
      findings.push({ id: "categories", severity: "blocker", message: "Sin categorías ACTIVE" });
    }
    for (const c of contest.categories) {
      if ((c.maxFiles ?? 0) < 1) {
        findings.push({
          id: `cat_max_${c.slug}`,
          severity: "blocker",
          message: `Categoría ${c.slug} maxFiles inválido`,
        });
      }
    }

    const published = contest.rulesVersions.find((r) => r.status === "PUBLISHED");
    const draft = contest.rulesVersions.some((r) => r.status === "DRAFT");
    if (!published) {
      findings.push({
        id: "rules_missing",
        severity: "blocker",
        message: draft
          ? "Solo hay borrador de bases; falta versión PUBLISHED oficial"
          : "No hay bases publicadas",
      });
    } else {
      const gate = evaluatePlaceholderGate({
        publishedContent: published.content,
        draftExists: draft,
      });
      if (gate.publishedContainsPlaceholder || contentContainsPlaceholder(published.content)) {
        findings.push({
          id: "rules_placeholder",
          severity: "blocker",
          message: "Bases publicadas contienen placeholder — no válidas para GO",
        });
      }
      for (const re of PLACEHOLDER_RES) {
        if (re.test(published.content)) {
          findings.push({
            id: "rules_placeholder_text",
            severity: "blocker",
            message: `Bases publicadas contienen marcador prohibido`,
          });
          break;
        }
      }
      if (!published.contentHash?.trim()) {
        findings.push({
          id: "rules_hash",
          severity: "blocker",
          message: "Versión publicada sin contentHash",
        });
      }
    }

    const paidOrders = await prisma.dnxPaymentOrder.count({
      where: {
        // soft: registrations with paymentOrderId
      },
    }).catch(() => 0);
    void paidOrders;

    const regsWithOrder = await prisma.fotorankContestRegistration.count({
      where: { contestId: contest.id, paymentOrderId: { not: null } },
    });
    if (regsWithOrder > 0) {
      findings.push({
        id: "free_has_orders",
        severity: "blocker",
        message: `${regsWithOrder} inscripciones FREE con paymentOrderId`,
      });
    }

    const nonFreePay = await prisma.fotorankContestRegistration.count({
      where: {
        contestId: contest.id,
        status: "CONFIRMED",
        NOT: { paymentStatus: "NOT_REQUIRED" },
      },
    });
    if (nonFreePay > 0) {
      findings.push({
        id: "confirmed_not_not_required",
        severity: "blocker",
        message: `${nonFreePay} CONFIRMED sin paymentStatus NOT_REQUIRED`,
      });
    }
  }

  const storageName = resolvePrivateStorageProviderName();
  const r2Configured = isR2PrivateStorageConfigured();
  if (storageName !== "r2" || !r2Configured) {
    findings.push({
      id: "r2_staging",
      severity: "blocker",
      message: `Storage provider=${storageName}, r2Configured=${r2Configured}. GO requiere R2 staging real.`,
    });
  }

  if (!hasEmailProvider()) {
    findings.push({
      id: "email_provider",
      severity: "blocker",
      message: "Sin RESEND_API_KEY ni FOTORANK_SMTP_URL — emails reales no configurados",
    });
  }

  const blockers = findings.filter((f) => f.severity === "blocker");
  const report = {
    ok: blockers.length === 0,
    releaseCandidate: "FOTORANK-SFEF-2026-RC1",
    database: db.database,
    contestSlug: SLUG,
    storageProvider: storageName,
    r2Configured,
    emailConfigured: hasEmailProvider(),
    findings,
    blockerCount: blockers.length,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(report, null, 2));
  if (blockers.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
