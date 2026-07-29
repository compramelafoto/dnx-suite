/**
 * Integración P0-09A — requiere DB + migración.
 * DATABASE_URL=...staging pnpm --filter fotorank run test:rules-config:integration
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import { assertSafeFotoRankDatabaseUrl } from "../../../../scripts/assert-safe-database-url";
import { buildSantaFeEnFoco2026Configuration } from "./santa-fe-en-foco-2026";
import {
  ensureSystemProvincialTemplate,
  importRulesTextDraft,
  publishConfigurationVersion,
  saveDraftConfiguration,
} from "./service";
import { compareRulesTextWithConfiguration, hasTextConfigConflicts } from "./compare-text";
import { publishRulesVersion, RULES_PLACEHOLDER_MARKER } from "../registration";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL no definida");
    return;
  }
  assertSafeFotoRankDatabaseUrl();

  if (typeof (prisma as { fotorankContestConfigurationVersion?: unknown }).fotorankContestConfigurationVersion !== "object") {
    console.log("SKIP: cliente Prisma sin FotorankContestConfigurationVersion (generate + migrate)");
    return;
  }

  const suffix = Date.now().toString(36);
  const password = createHash("sha256").update(suffix).digest("hex");
  const admin = await prisma.user.create({
    data: { email: `cfg-admin-${suffix}@fotorank.local`, name: "Cfg Admin", password },
  });
  const org = await prisma.contestOrganization.create({
    data: {
      name: `Org CFG ${suffix}`,
      slug: `org-cfg-${suffix}`,
      platformFeeBps: 0,
      createdByUserId: admin.id,
    },
  });
  await prisma.contestOrganizationMember.create({
    data: { organizationId: org.id, userId: admin.id, role: "OWNER", status: "ACTIVE" },
  });
  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: "CFG Test",
      slug: `cfg-${suffix}`,
      status: "DRAFT",
      visibility: "PUBLIC",
      createdByUserId: admin.id,
      timezone: "America/Argentina/Cordoba",
    },
  });

  const config = buildSantaFeEnFoco2026Configuration();
  config.identity.slug = contest.slug;

  const draft = await saveDraftConfiguration({
    contestId: contest.id,
    config,
    createdByUserId: admin.id,
  });
  assert.ok(draft.id);

  // Publicar con allowPendingHuman (staging técnico)
  const published = await publishConfigurationVersion({
    contestId: contest.id,
    versionId: draft.id,
    actorUserId: admin.id,
    allowPendingHuman: true,
  });
  assert.ok(published.hash);

  const contestAfter = await prisma.fotorankContest.findUniqueOrThrow({ where: { id: contest.id } });
  assert.equal(contestAfter.registrationPricingMode, "FREE");
  assert.equal(contestAfter.registrationPriceAmountMinor, 0);
  assert.equal(contestAfter.title, "Santa Fe en Foco 2026");

  const cats = await prisma.fotorankContestCategory.findMany({ where: { contestId: contest.id } });
  assert.equal(cats.filter((c) => c.status === "ACTIVE").length, 4);

  // Inmutabilidad: re-publicar misma versión falla
  let immutable = false;
  try {
    await publishConfigurationVersion({
      contestId: contest.id,
      versionId: draft.id,
      actorUserId: admin.id,
      allowPendingHuman: true,
    });
  } catch {
    immutable = true;
  }
  assert.equal(immutable, true);

  // Import bases + compare
  const goodText = [
    "Participación gratuita.",
    "Una sola fotografía.",
    "GPS recomendado.",
    "EXIF recomendado.",
    "Fotomontaje prohibido.",
    "IA generativa prohibida.",
    "Licencia por 12 meses.",
    "Cuatro categorías: Profesional, Reportero Gráfico, Amateur, Dron.",
    "Primer premio 500.000.",
    "Mayores de 16 años.",
  ].join("\n");

  const imported = await importRulesTextDraft({
    contestId: contest.id,
    configurationVersionId: draft.id,
    title: "Bases borrador test",
    content: goodText,
    createdByUserId: admin.id,
  });
  assert.ok(imported.rulesVersionId);

  const cmp = compareRulesTextWithConfiguration(goodText, config);
  assert.equal(hasTextConfigConflicts(cmp), false);

  const bad = "El GPS será obligatorio. El concurso cuesta $1000.";
  assert.equal(hasTextConfigConflicts(compareRulesTextWithConfiguration(bad, config)), true);

  // Placeholder import falla
  let placeholderBlocked = false;
  try {
    await importRulesTextDraft({
      contestId: contest.id,
      configurationVersionId: draft.id,
      title: "bad",
      content: `${RULES_PLACEHOLDER_MARKER}\ntexto`,
      createdByUserId: admin.id,
    });
  } catch {
    placeholderBlocked = true;
  }
  assert.equal(placeholderBlocked, true);

  await ensureSystemProvincialTemplate(admin.id);
  const tpl = await prisma.fotorankContestRulesTemplate.findUnique({
    where: { slug: "concurso-fotografico-provincial" },
  });
  assert.ok(tpl);

  // Cross-org: otro org no ve (permiso se valida en UI; aquí solo datos aislados)
  void publishRulesVersion;

  console.log(
    JSON.stringify(
      {
        ok: true,
        contestId: contest.id,
        configurationVersionId: draft.id,
        hash: published.hash.slice(0, 12),
        categories: cats.length,
      },
      null,
      2,
    ),
  );
  console.log("rules-config.integration.selfcheck.ts OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
