/**
 * Seed idempotente — Santa Fe en Foco (local / staging).
 *
 * Uso:
 *   pnpm --filter @repo/db exec tsx prisma/scripts/seed-santa-fe-en-foco.ts
 *
 * Bloquea ejecución si NODE_ENV=production o VERCEL_ENV=production
 * (las bases incluyen placeholder legal).
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "santa-fe-en-foco";
const ORG_SLUG = "santa-fe-en-foco-org";

/** Categorías oficiales ETAPA 05 — participación abierta; sin residencia. */
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
      "Para reporteros gráficos. Es obligatorio ingresar un número de socio de ARGRA, sujeto a verificación por la organización. PENDING_INSTITUTIONAL_APPROVAL / LEGAL REVIEW REQUIRED.",
  },
  {
    slug: "fotografia-aerea",
    name: "Fotografía Aérea",
    sortOrder: 4,
    description:
      "Para fotografías realizadas con dron. La organización podrá solicitar información técnica o documentación adicional. LEGAL REVIEW REQUIRED.",
  },
] as const;

/** Slugs legacy a desactivar (no borrar filas). */
const LEGACY_CATEGORY_SLUGS = ["santa-fe-en-foco", "celular", "camara"] as const;

const RULES_PLACEHOLDER = `BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR

Santa Fe en Foco — bases provisorias para pruebas de inscripción (staging).

1. Modalidad gratuita. Participación abierta: no se exige residencia en la Provincia de Santa Fe.
2. La fotografía debe haberse tomado en la Provincia de Santa Fe y durante el período oficial.
3. Una inscripción por persona; una categoría; una fotografía JPG/JPEG.
4. Categorías: Fotógrafo Profesional, Fotógrafo Amateur, Reportero Gráfico (ARGRA), Fotografía Aérea (dron).
5. EXIF recomendado; ausencia de fecha/GPS no implica rechazo automático (revisión manual).
6. El participante acepta estas bases al inscribirse.

Este texto NO es válido para producción.`;

function hashContent(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\s+$/u, "");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error(
      "seed-santa-fe-en-foco bloqueado en producción (contiene bases placeholder).",
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
      name: "Santa Fe en Foco (org seed)",
      platformFeeBps: 0,
    },
    create: {
      name: "Santa Fe en Foco (org seed)",
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
  const regCloses = new Date("2026-09-30T02:59:59.000Z");
  const submissionOpens = new Date("2026-08-01T03:00:00.000Z");
  const submissionDeadline = new Date("2026-09-30T02:59:59.000Z");

  /** BORRADOR — VALIDAR ANTES DE PRODUCCIÓN */
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
    allowReplaceUntilSubmissionClose: true,
    draftConfig: true,
    notes: "BORRADOR — VALIDAR ANTES DE PRODUCCIÓN",
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
        "Participación abierta. Fotografía tomada en la Provincia de Santa Fe — seed local/staging ETAPA 05.",
      rulesText: RULES_PLACEHOLDER,
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
        "Participación abierta. Fotografía tomada en la Provincia de Santa Fe — seed local/staging ETAPA 05.",
      rulesText: RULES_PLACEHOLDER,
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

  // Desactivar categorías legacy sin borrar filas (pueden tener obras de fixtures).
  for (const legacySlug of LEGACY_CATEGORY_SLUGS) {
    await prisma.fotorankContestCategory.updateMany({
      where: { contestId: contest.id, slug: legacySlug },
      data: { status: "ARCHIVED" },
    });
  }

  const contentHash = hashContent(RULES_PLACEHOLDER);
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
        title: "Bases Santa Fe en Foco (borrador seed)",
        content: RULES_PLACEHOLDER,
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
  console.log(
    `  FREE · fee 0 bps · categorías: profesional/amateur/reportero/aerea · maxFiles=1 · residencia NO requerida`,
  );
  console.log(`  registrationOpensAt: ${opens.toISOString()}`);
  console.log(`  Fixtures jurado/obras: correr apps/fotorank/scripts/seed-santa-fe-p0-07-jury-fixtures.ts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
