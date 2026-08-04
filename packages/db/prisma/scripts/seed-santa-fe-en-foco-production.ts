/**
 * Seed de producción — Santa Fe en Foco RC01 (idempotente).
 *
 * HARD GATES (todas deben cumplirse):
 *   FOTORANK_PRODUCTION_SEED_CONFIRM=SANTA_FE_EN_FOCO_PRODUCTION_2026
 *   FOTORANK_CONTEST_SLUG_CONFIRM=santa-fe-en-foco  (o arg --slug=santa-fe-en-foco)
 *   NODE_ENV/VERCEL_ENV=production  OR  ALLOW_PRODUCTION_SEED=1 + misma frase de confirmación
 *   DATABASE_URL host no staging (denylist)
 *
 * registrationEnabled queda en false por defecto (validación operativa previa al GO).
 * Upload/submission cerrados (submissionOpensAt 2099). Jurado/resultados OFF.
 *
 * Uso:
 *   FOTORANK_PRODUCTION_SEED_CONFIRM=SANTA_FE_EN_FOCO_PRODUCTION_2026 \
 *   FOTORANK_CONTEST_SLUG_CONFIRM=santa-fe-en-foco \
 *   ALLOW_PRODUCTION_SEED=1 \
 *   pnpm --filter @repo/db db:seed:santa-fe-en-foco:production
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "santa-fe-en-foco";
const ORG_SLUG = "santa-fe-en-foco-org";
const CONFIRM_PHRASE = "SANTA_FE_EN_FOCO_PRODUCTION_2026";

const STAGING_HOST_DENYLIST = [
  "ep-round-fog",
  "staging",
  "localhost",
  "127.0.0.1",
  ".neon.tech", // tighten below — only block known staging fragments
];

/** Fragmentos explícitos de hosts de staging conocidos. */
const STAGING_URL_FRAGMENTS = [
  "ep-round-fog",
  "staging.fotorank",
  "fotorank-staging",
  "vercel-staging",
  "-staging-",
];

const OFFICIAL_CATEGORIES = [
  {
    slug: "fotografo-profesional",
    name: "Fotógrafo Profesional",
    sortOrder: 1,
    description:
      "Para personas que participan como fotógrafos profesionales. La fotografía debe haber sido realizada con una cámara fotográfica. No se admiten fotografías tomadas con teléfono celular.",
  },
  {
    slug: "fotografo-amateur",
    name: "Fotógrafo Amateur",
    sortOrder: 2,
    description:
      "Para fotógrafos aficionados. Se admiten fotografías realizadas con teléfono celular o cámara fotográfica.",
  },
  {
    slug: "reportero-grafico",
    name: "Reportero Gráfico",
    sortOrder: 3,
    description:
      "Para reporteros gráficos. Es obligatorio ingresar un número de socio de ARGRA, sujeto a verificación por la organización.",
  },
  {
    slug: "fotografia-aerea",
    name: "Fotografía Aérea",
    sortOrder: 4,
    description:
      "Para fotografías realizadas con dron. La organización podrá solicitar información técnica o documentación adicional.",
  },
] as const;

const LEGACY_CATEGORY_SLUGS = ["santa-fe-en-foco", "celular", "camara"] as const;

const AUTHORIZATION_META = {
  path: "CAMINO_B",
  legalStatus: "PROVISIONALLY_AUTHORIZED_PENDING_LEGAL_REVIEW",
  authorizedByName: "PENDING_OPERATOR_INPUT",
  authorizedByRole: "PENDING_OPERATOR_INPUT",
  authorizationDate: "2026-08-04",
  note: "LEGAL REVIEW REQUIRED (internal) — provisional texts authorized pending professional legal review.",
  termsVersion: "santa-fe-en-foco-terms-v2026-08-04-provisional",
  privacyVersion: "santa-fe-en-foco-privacy-v2026-08-04-provisional",
  consentVersion: "santa-fe-en-foco-consents-v2026-08-04-provisional",
} as const;

function hashContent(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\s+$/u, "");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function parseSlugArg(argv: string[]): string | null {
  for (const a of argv) {
    if (a.startsWith("--slug=")) return a.slice("--slug=".length).trim();
  }
  return null;
}

function assertProductionSeedGates(): void {
  const confirm = process.env.FOTORANK_PRODUCTION_SEED_CONFIRM?.trim();
  if (confirm !== CONFIRM_PHRASE) {
    throw new Error(
      `Abort: seteá FOTORANK_PRODUCTION_SEED_CONFIRM=${CONFIRM_PHRASE}`,
    );
  }

  const slugConfirm =
    parseSlugArg(process.argv.slice(2)) ||
    process.env.FOTORANK_CONTEST_SLUG_CONFIRM?.trim() ||
    "";
  if (slugConfirm !== SLUG) {
    throw new Error(
      `Abort: confirmá el slug con FOTORANK_CONTEST_SLUG_CONFIRM=${SLUG} o --slug=${SLUG}`,
    );
  }

  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  const allowExplicit = process.env.ALLOW_PRODUCTION_SEED === "1";
  const intentionalProd =
    nodeEnv === "production" || vercelEnv === "production" || allowExplicit;
  if (!intentionalProd) {
    throw new Error(
      "Abort: requiere NODE_ENV/VERCEL_ENV=production o ALLOW_PRODUCTION_SEED=1 con frase de confirmación.",
    );
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) throw new Error("Abort: DATABASE_URL ausente.");

  let host = "";
  try {
    host = new URL(dbUrl).hostname.toLowerCase();
  } catch {
    throw new Error("Abort: DATABASE_URL inválida.");
  }

  const urlLower = dbUrl.toLowerCase();
  for (const frag of STAGING_URL_FRAGMENTS) {
    if (urlLower.includes(frag) || host.includes(frag)) {
      throw new Error(`Abort: DATABASE_URL parece staging (fragmento "${frag}"). Host=${host}`);
    }
  }
  // Denylist residual (hosts locales / patrones conocidos).
  for (const frag of STAGING_HOST_DENYLIST) {
    if (frag === ".neon.tech") continue; // neon puede ser prod; solo fragmentos staging arriba
    if (host === frag || host.includes(frag)) {
      throw new Error(`Abort: host denegado para seed de producción: ${host}`);
    }
  }

  console.log("[seed-santa-fe-en-foco-production] gates OK");
  console.log(`  host: ${host}`);
  console.log(`  authorization: ${AUTHORIZATION_META.path} / ${AUTHORIZATION_META.legalStatus}`);
  console.log(
    `  authorizedBy: ${AUTHORIZATION_META.authorizedByName} (${AUTHORIZATION_META.authorizedByRole}) @ ${AUTHORIZATION_META.authorizationDate}`,
  );
}

function loadLegalMarkdown(relativeFromRepo: string, fallback: string): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // packages/db/prisma/scripts → repo root
    const root = resolve(here, "../../../../");
    const full = resolve(root, relativeFromRepo);
    if (existsSync(full)) {
      return readFileSync(full, "utf8");
    }
  } catch {
    /* use fallback */
  }
  return fallback;
}

const FALLBACK_TERMS = `# Bases — Santa Fe en Foco 2026

legalStatus: PROVISIONALLY_AUTHORIZED_PENDING_LEGAL_REVIEW
caminoB: true
authorizedByName: PENDING_OPERATOR_INPUT
authorizedByRole: PENDING_OPERATOR_INPUT
authorizationDate: 2026-08-04
version: santa-fe-en-foco-terms-v2026-08-04-provisional
INTERNAL: LEGAL REVIEW REQUIRED

## Organizador
Sociedad de Fotógrafos Profesionales de Rosario. Contacto: sfprosario@gmail.com.
Desarrollado sobre FotoRank (https://fotorank.com).

## Modalidad
Inscripción gratuita. Participación abierta: no se exige residencia en la Provincia de Santa Fe.
La fotografía debe haber sido tomada en la Provincia de Santa Fe entre el 1 de agosto y el 30 de septiembre de 2026 inclusive.

## Requisitos
- Edad mínima: 16 años. Participantes de 16 o 17 años requieren autorización de padre, madre o tutor legal.
- Usuario de Instagram obligatorio (no se exige cuenta pública).
- Una inscripción, una categoría y una fotografía por participante.
- Categorías: Fotógrafo Profesional, Fotógrafo Amateur, Reportero Gráfico (ARGRA), Fotografía Aérea.

## Premios (por categoría)
1º premio ARS 500.000 · 2º premio ARS 400.000 · 3º premio ARS 300.000.

## Carga de fotografías
La inscripción puede estar abierta mientras la carga de fotografías permanece cerrada hasta su habilitación oficial.

## Comunicaciones
Al inscribirse, el participante acepta recibir comunicaciones operativas necesarias del concurso.
El consentimiento promocional es opcional.
`;

async function main() {
  assertProductionSeedGates();

  const admin =
    (await prisma.user.findUnique({ where: { email: "admin@fotorank.com" } })) ??
    (await prisma.user.findFirst({ orderBy: { id: "asc" } }));
  if (!admin) {
    throw new Error("No hay usuarios en la DB.");
  }

  const termsContent = loadLegalMarkdown(
    "docs/fotorank/legal/santa-fe-en-foco-terms-v2026-08-04-provisional.md",
    FALLBACK_TERMS,
  );
  for (const banned of ["NO PUBLICAR", "BORRADOR", "STAGING_TEST"]) {
    if (termsContent.includes(banned)) {
      throw new Error(`Abort: texto legal contiene marcador prohibido "${banned}".`);
    }
  }

  const org = await prisma.contestOrganization.upsert({
    where: { slug: ORG_SLUG },
    update: {
      name: "Sociedad de Fotógrafos Profesionales de Rosario",
      platformFeeBps: 0,
    },
    create: {
      name: "Sociedad de Fotógrafos Profesionales de Rosario",
      slug: ORG_SLUG,
      platformFeeBps: 0,
      createdByUserId: admin.id,
    },
  });

  await prisma.contestOrganizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: admin.id },
    },
    update: { status: "ACTIVE", role: "OWNER" },
    create: {
      organizationId: org.id,
      userId: admin.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const opens = new Date("2026-08-01T03:00:00.000Z");
  const regCloses = new Date("2026-10-01T03:00:00.000Z");
  const submissionOpens = new Date("2099-01-01T03:00:00.000Z");
  const submissionDeadline = new Date("2099-12-31T03:00:00.000Z");

  const uploadPolicyJson = {
    allowedMimeTypes: ["image/jpeg"],
    allowedExtensions: ["jpg", "jpeg"],
    maxFileSizeBytes: 25 * 1024 * 1024,
    requireExif: false,
    requireCaptureDate: false,
    requireGps: false,
    allowEditedFiles: true,
    maxEntriesPerRegistration: 1,
    allowReplaceUntilSubmissionClose: false,
    uploadEnabled: false,
    notes: "RC01 production: upload closed until official enablement.",
    authorization: AUTHORIZATION_META,
  };

  const contest = await prisma.fotorankContest.upsert({
    where: {
      organizationId_slug: { organizationId: org.id, slug: SLUG },
    },
    update: {
      title: "Santa Fe en Foco",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      // Leave false for validation GO gate — operator flips when ready.
      registrationEnabled: false,
      registrationPricingMode: "FREE",
      registrationPriceAmountMinor: 0,
      registrationCurrency: "ARS",
      registrationOpensAt: opens,
      registrationClosesAt: regCloses,
      submissionOpensAt: submissionOpens,
      submissionDeadline,
      platformFeeBps: 0,
      timezone: "America/Argentina/Cordoba",
      allowRegistrationCancellation: true,
      uploadPolicyJson,
      shortDescription:
        "Edición 2026 · Inscripción gratuita · Participación abierta · Desarrollado sobre FotoRank · sfprosario@gmail.com",
      rulesText: termsContent,
    },
    create: {
      organizationId: org.id,
      title: "Santa Fe en Foco",
      slug: SLUG,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      experienceType: "CONTEST",
      registrationEnabled: false,
      registrationPricingMode: "FREE",
      registrationPriceAmountMinor: 0,
      registrationCurrency: "ARS",
      registrationOpensAt: opens,
      registrationClosesAt: regCloses,
      submissionOpensAt: submissionOpens,
      submissionDeadline,
      platformFeeBps: 0,
      timezone: "America/Argentina/Cordoba",
      allowRegistrationCancellation: true,
      uploadPolicyJson,
      shortDescription:
        "Edición 2026 · Inscripción gratuita · Participación abierta · Desarrollado sobre FotoRank · sfprosario@gmail.com",
      rulesText: termsContent,
      createdByUserId: admin.id,
    },
  });

  for (const cat of OFFICIAL_CATEGORIES) {
    await prisma.fotorankContestCategory.upsert({
      where: { contestId_slug: { contestId: contest.id, slug: cat.slug } },
      update: {
        name: cat.name,
        maxFiles: 1,
        status: "ACTIVE",
        sortOrder: cat.sortOrder,
        description: cat.description,
      },
      create: {
        contestId: contest.id,
        name: cat.name,
        slug: cat.slug,
        maxFiles: 1,
        status: "ACTIVE",
        sortOrder: cat.sortOrder,
        description: cat.description,
      },
    });
  }

  for (const legacySlug of LEGACY_CATEGORY_SLUGS) {
    await prisma.fotorankContestCategory.updateMany({
      where: { contestId: contest.id, slug: legacySlug },
      data: { status: "ARCHIVED" },
    });
  }

  const contentHash = hashContent(termsContent);
  const existingPublished = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: contest.id, status: "PUBLISHED" },
    orderBy: { versionNumber: "desc" },
  });

  if (!existingPublished || existingPublished.contentHash !== contentHash) {
    if (existingPublished) {
      await prisma.fotorankContestRulesVersion.update({
        where: { id: existingPublished.id },
        data: { status: "ARCHIVED" },
      });
    }
    const last = await prisma.fotorankContestRulesVersion.findFirst({
      where: { contestId: contest.id },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    await prisma.fotorankContestRulesVersion.create({
      data: {
        contestId: contest.id,
        versionNumber: (last?.versionNumber ?? 0) + 1,
        title: "Bases Santa Fe en Foco 2026 (provisional CAMINO B)",
        content: termsContent,
        contentHash,
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdByUserId: admin.id,
      },
    });
  }

  console.log("[seed-santa-fe-en-foco-production] OK");
  console.log(`  org: ${org.slug} (${org.id})`);
  console.log(`  contest: /concursos/${contest.slug} (${contest.id})`);
  console.log(`  registrationEnabled: false (operator must enable)`);
  console.log(`  upload: CLOSED (submissionOpensAt 2099)`);
  console.log(`  termsVersion: ${AUTHORIZATION_META.termsVersion}`);
  console.log(`  legalStatus: ${AUTHORIZATION_META.legalStatus}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
