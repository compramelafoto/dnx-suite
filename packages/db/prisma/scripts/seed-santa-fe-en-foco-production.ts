/**
 * Seed productivo acotado — Santa Fe en Foco (ETAPA 09 CAMINO B).
 *
 * REQUIERE:
 *   SFEF_INSTITUTIONAL_AUTH=1
 *   SFEF_ALLOW_PRODUCTION_SEED=1
 *   DATABASE_URL = Production
 *
 * Upload cerrado. Bases: sfef-provisional-institutional-v1
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "santa-fe-en-foco";
const ORG_SLUG = "santa-fe-en-foco-org";
const SFEF_PROVISIONAL_RULES_VERSION = "sfef-provisional-institutional-v1";

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
      "Para reporteros gráficos. Es obligatorio ingresar un número de socio de ARGRA, sujeto a verificación por la organización. El dato es privado.",
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

function rulesContent(): string {
  return `# Bases y Condiciones — Santa Fe en Foco 2026

## Aviso de vigencia
Versión **${SFEF_PROVISIONAL_RULES_VERSION}**.
Publicación provisoria autorizada institucionalmente por **Mario Alberto Laus**, Presidente de la Sociedad de Fotógrafos Profesionales de Rosario (2026-08-04), para la apertura de inscripciones.
Esta versión puede ser reemplazada por una edición con revisión jurídica formal. La carga de fotografías permanece cerrada hasta nueva confirmación operativa.

## 1. Presentación
El concurso fotográfico **Santa Fe en Foco 2026** se desarrolla sobre la plataforma FotoRank.

## 2. Organizadores
Organizan el concurso:
- Sociedad de Fotógrafos Profesionales de Rosario.
- Cámara de Senadores de la Provincia de Santa Fe.

## 3. Objeto
Difundir el deporte santafesino desde una perspectiva documental, cultural, social, territorial o humana. Las obras no deben referirse exclusivamente a los Juegos Suramericanos.

## 4. Participantes
La participación es abierta. No es necesario residir en la Provincia de Santa Fe. La fotografía deberá haber sido realizada dentro del territorio provincial y durante el período oficial del concurso.

El criterio geográfico se aplica a la fotografía, no al domicilio del participante.

## 5. Menores
La edad mínima es de 16 años. Los participantes de 16 y 17 años requieren autorización expresa de padre, madre o tutor legal, que debe aceptarse antes de confirmar la inscripción.

## 6. Gratuidad
La participación es gratuita. No se cobra precio de inscripción ni fee de plataforma en esta edición.

## 7. Territorio de la fotografía
Las fotografías deben haberse tomado dentro de la Provincia de Santa Fe. El participante declara localidad o paraje y confirma el territorio. El GPS es opcional, no se publica y no genera rechazo automático por ausencia; inconsistencias pueden derivar a revisión manual.

## 8. Cronograma
- Apertura de inscripción: 1 de agosto de 2026 (00:00, America/Argentina/Cordoba).
- Cierre de inscripción: 30 de septiembre de 2026 inclusive (cierre exclusivo 1 de octubre de 2026, 00:00).
- Ventana de captura válida: desde el 1 de agosto hasta el 30 de septiembre de 2026 inclusive (fuente principal: DateTimeOriginal).
- La carga de fotografías se habilitará en una etapa posterior confirmada por la organización.

## 9. Categorías
1. Fotógrafo Profesional — cámara fotográfica; celular no permitido.
2. Fotógrafo Amateur — celular o cámara.
3. Reportero Gráfico — número de socio ARGRA obligatorio (verificación posterior por la organización; el dato es privado; no se afirma asociación oficial del concurso con ARGRA).
4. Fotografía Aérea — realizada con dron; la organización podrá solicitar información técnica o documentación adicional.

Cada participante elige una sola categoría. Una misma fotografía no compite en más de una categoría.

## 10. Cantidad de obras
Se admite una sola fotografía por inscripción / participante.

## 11. Temática
Fotografías vinculadas al deporte santafesino, con mirada documental, cultural, social, territorial o humana.

## 12. Requisitos técnicos (cuando se habilite la carga)
Formatos admitidos por la plataforma: JPEG. Pueden aplicarse límites técnicos internos de seguridad de infraestructura.

## 13. Metadatos
Se recomienda conservar EXIF y fecha de captura. La ausencia de metadatos no implica rechazo automático; puede generar advertencia o revisión manual. Las coordenadas GPS exactas no se publican.

## 14. Edición
Se permite el revelado fotográfico básico sin alteración sustancial de la escena. Queda prohibido el fotomontaje, la combinación de fotografías, el agregado o eliminación de personas u objetos relevantes, el reemplazo de cielo, firmas y marcas de agua.

## 15. Inteligencia artificial
Queda prohibida la inteligencia artificial generativa (imagen generada total o parcialmente, relleno, eliminación, expansión, agregado o reemplazo generativos). Se permiten herramientas no generativas de flujo de trabajo siempre que no inventen, agreguen ni eliminen contenido de la escena.

## 16. Autoría
El autor conserva la titularidad de la obra y declara su autoría al participar.

## 17. Derechos de imagen
El participante declara contar con las autorizaciones necesarias respecto de terceros cuando corresponda.

## 18. Licencia
La aceptación de la licencia es obligatoria para participar. Se otorga a los organizadores una licencia exclusiva, gratuita y temporal por 12 meses desde la finalización oficial, con fines institucionales, culturales, educativos, promocionales, de publicación, exhibición, reproducción, redes, catálogos, productos y uso comercial, con atribución al autor. Las obras seleccionadas podrán integrarse a un archivo patrimonial de uso cultural, histórico e institucional permanente. Esta cláusula podrá ajustarse tras revisión jurídica formal.

## 19. Premios
Los premios por categoría se comunicarán o confirmarán por los canales oficiales. Mientras no haya confirmación definitiva, se informa que los reconocimientos existen y están sujetos a confirmación institucional.

## 20. Privacidad
Los datos personales se tratan conforme a la normativa aplicable y a la política de privacidad de la plataforma FotoRank. El número ARGRA, si se declara, es privado y no se publica.

## 21. Comunicaciones
Las comunicaciones operativas del concurso pueden enviarse a los datos de contacto declarados. Las comunicaciones promocionales opcionales requieren consentimiento separado.

## 22. Aceptación
La inscripción implica la aceptación de estas Bases y Condiciones y de la licencia necesaria para participar.

## 23. Contacto
Las consultas se canalizan a través de la plataforma FotoRank y los canales institucionales de los organizadores.
`;
}

function hashContent(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\s+$/u, "");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function assertProductionAuth() {
  if (process.env.SFEF_INSTITUTIONAL_AUTH !== "1") {
    throw new Error("ABORT: SFEF_INSTITUTIONAL_AUTH=1 requerido (CAMINO B).");
  }
  if (process.env.SFEF_ALLOW_PRODUCTION_SEED !== "1") {
    throw new Error("ABORT: SFEF_ALLOW_PRODUCTION_SEED=1 requerido.");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("ABORT: DATABASE_URL ausente.");
  if (/ep-round-fog|staging|localhost|127\.0\.0\.1|fotorank_staging/i.test(url)) {
    throw new Error("ABORT: DATABASE_URL parece staging/local.");
  }
}

async function main() {
  assertProductionAuth();

  const admin =
    (await prisma.user.findUnique({ where: { email: "admin@fotorank.com" } })) ??
    (await prisma.user.findFirst({ orderBy: { id: "asc" } }));
  if (!admin) {
    throw new Error("No hay usuarios en la DB productiva. Crear admin antes del seed.");
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

  // Contacto institucional SFPR — organizador real del concurso.
  const institutionalOwnerEmail =
    (process.env.SFEF_ORG_OWNER_EMAIL ?? "sfprosario@gmail.com").trim().toLowerCase();
  const institutionalOwner = await prisma.user.findUnique({
    where: { email: institutionalOwnerEmail },
    select: { id: true, email: true },
  });
  if (institutionalOwner) {
    await prisma.contestOrganizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: institutionalOwner.id,
        },
      },
      update: { status: "ACTIVE", role: "OWNER" },
      create: {
        organizationId: org.id,
        userId: institutionalOwner.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });
  } else {
    console.warn(
      `[seed-sfef-prod] usuario institucional no encontrado: ${institutionalOwnerEmail}`,
    );
  }

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
    allowReplaceUntilSubmissionClose: true,
    draftConfig: false,
    publicUploadOpen: false,
    notes: "UPLOAD_PUBLIC_OPEN=false — ETAPA 09",
  };

  const content = rulesContent();

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
        "La participación es abierta. No es necesario residir en la Provincia de Santa Fe. La fotografía deberá haber sido realizada dentro del territorio provincial y durante el período oficial del concurso.",
      rulesText: content,
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
        "La participación es abierta. No es necesario residir en la Provincia de Santa Fe. La fotografía deberá haber sido realizada dentro del territorio provincial y durante el período oficial del concurso.",
      rulesText: content,
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

  const contentHash = hashContent(content);
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
        title: `Bases Santa Fe en Foco (${SFEF_PROVISIONAL_RULES_VERSION})`,
        content,
        contentHash,
        status: "PUBLISHED",
        publishedAt: new Date(),
        legalReviewStatus: "NOT_REQUIRED",
        createdByUserId: admin.id,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: contest.slug,
        contestId: contest.id,
        rulesVersion: SFEF_PROVISIONAL_RULES_VERSION,
        registrationEnabled: true,
        uploadOpen: false,
        institutionalAuth: "Mario Alberto Laus / SFPR / CAMINO B",
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
