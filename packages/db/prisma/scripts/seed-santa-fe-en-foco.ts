/**
 * Seed idempotente — Santa Fe en Foco (local / staging).
 *
 * Uso:
 *   pnpm --filter @repo/db exec tsx prisma/scripts/seed-santa-fe-en-foco.ts
 *
 * Bloquea ejecución si NODE_ENV=production o VERCEL_ENV=production.
 * Para producción usar: seed-santa-fe-en-foco-production.ts
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "santa-fe-en-foco";
const ORG_SLUG = "santa-fe-en-foco-org";

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

const RULES_STAGING = `STAGING_TEST_CONFIGURATION — no usar en producción

Santa Fe en Foco — bases de prueba de inscripción (staging).

1. Modalidad gratuita. Participación abierta: no se exige residencia en la Provincia de Santa Fe.
2. La fotografía debe haberse tomado en la Provincia de Santa Fe y durante el período oficial (1 ago – 30 sep 2026).
3. Una inscripción por persona; una categoría; una fotografía.
4. Categorías: Fotógrafo Profesional, Fotógrafo Amateur, Reportero Gráfico (ARGRA), Fotografía Aérea (dron).
5. Instagram obligatorio en la inscripción.
6. Edad mínima 16 años; menores 16–17 con autorización de tutor.
7. El participante acepta estas bases al inscribirse.

Este texto es solo para entornos de prueba.`;

function hashContent(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\s+$/u, "");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error(
      "seed-santa-fe-en-foco bloqueado en producción. Usá seed-santa-fe-en-foco-production.ts",
    );
  }

  const admin =
    (await prisma.user.findUnique({ where: { email: "admin@fotorank.com" } })) ??
    (await prisma.user.findFirst({ orderBy: { id: "asc" } }));
  if (!admin) {
    throw new Error("No hay usuarios en la DB. Corré primero el seed principal.");
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

  const opens = new Date("2026-08-01T03:00:00.000Z"); // 00:00 ART
  const regCloses = new Date("2026-10-01T03:00:00.000Z"); // exclusive-ish end
  // Upload closed in RC01 even on staging seed path for safer defaults.
  const submissionOpens = new Date("2099-01-01T03:00:00.000Z");
  const submissionDeadline = new Date("2099-12-31T03:00:00.000Z");

  const uploadPolicyJson = {
    allowedMimeTypes: ["image/jpeg"],
    allowedExtensions: ["jpg", "jpeg"],
    maxFileSizeBytes: 25 * 1024 * 1024,
    minWidth: 1200,
    minHeight: 800,
    maxWidth: 12000,
    maxHeight: 12000,
    minMegapixels: 1.5,
    requireExif: false,
    requireCaptureDate: false,
    requireGps: false,
    allowEditedFiles: true,
    maxEntriesPerRegistration: 1,
    allowReplaceUntilSubmissionClose: false,
    uploadEnabled: false,
    notes: "RC01: carga de fotografías cerrada hasta habilitación operativa.",
  };

  const contest = await prisma.fotorankContest.upsert({
    where: {
      organizationId_slug: { organizationId: org.id, slug: SLUG },
    },
    update: {
      title: "Santa Fe en Foco",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      registrationEnabled: true,
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
        "Edición 2026 · Participación abierta y gratuita. Desarrollado sobre FotoRank. Contacto: sfprosario@gmail.com",
      rulesText: RULES_STAGING,
    },
    create: {
      organizationId: org.id,
      title: "Santa Fe en Foco",
      slug: SLUG,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      experienceType: "CONTEST",
      registrationEnabled: true,
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
        "Edición 2026 · Participación abierta y gratuita. Desarrollado sobre FotoRank. Contacto: sfprosario@gmail.com",
      rulesText: RULES_STAGING,
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

  const contentHash = hashContent(RULES_STAGING);
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
        title: "Bases Santa Fe en Foco (staging)",
        content: RULES_STAGING,
        contentHash,
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdByUserId: admin.id,
      },
    });
  }

  console.log("[seed-santa-fe-en-foco] OK");
  console.log(`  org: ${org.slug} (${org.id})`);
  console.log(`  contest: /concursos/${contest.slug} (${contest.id})`);
  console.log(`  FREE · upload CLOSED · categorías oficiales · Instagram required`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
