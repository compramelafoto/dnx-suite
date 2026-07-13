/**
 * Asigna INFOSPOT_DIRECTOR a un User ya existente (p. ej. tras login Google en Production).
 *
 * Uso (desde la raíz del monorepo):
 *   INFOSPOT_DIRECTOR_EMAIL="persona@dominio.com" \
 *   DATABASE_URL="…" DIRECT_URL="…" \
 *   pnpm --filter @repo/db db:grant-infospot-director
 *
 * Requisitos:
 * - INFOSPOT_DIRECTOR_EMAIL obligatorio (sin default en código).
 * - El User debe existir previamente (login OAuth o creación autorizada).
 * - No crea usuarios, no imprime la contraseña, no publica contenido.
 *
 * Idempotente: upsert del rol a INFOSPOT_DIRECTOR ACTIVE + DIRECT_PUBLISH.
 */
import { prisma } from "../../src/client.js";

const emailRaw = process.env.INFOSPOT_DIRECTOR_EMAIL?.trim();
if (!emailRaw) {
  console.error(
    "Falta INFOSPOT_DIRECTOR_EMAIL. Ejemplo:\n  INFOSPOT_DIRECTOR_EMAIL=persona@dominio.com pnpm --filter @repo/db db:grant-infospot-director",
  );
  process.exit(1);
}

const email = emailRaw.toLowerCase();
if (!email.includes("@")) {
  console.error("INFOSPOT_DIRECTOR_EMAIL inválido.");
  process.exit(1);
}

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!domain) return "(invalid)";
  const safeLocal = local.length <= 2 ? "**" : `${local[0]}***${local[local.length - 1]}`;
  return `${safeLocal}@${domain}`;
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      isBlocked: true,
      role: true,
      infoSpotRoles: {
        select: { role: true, status: true, canPublish: true, publicationPolicy: true },
        take: 1,
      },
    },
  });

  if (!user) {
    console.error(
      `No existe User para ${maskEmail(email)}. Iniciá sesión una vez en https://infospot-dnxsuite.vercel.app/ingresar y reintentá.`,
    );
    process.exit(2);
  }
  if (user.isBlocked) {
    console.error(`User ${user.id} está bloqueado a nivel suite.`);
    process.exit(1);
  }

  const existingRole = user.infoSpotRoles[0] ?? null;
  const previous = existingRole
    ? {
        role: existingRole.role,
        status: existingRole.status,
        canPublish: existingRole.canPublish,
        publicationPolicy: existingRole.publicationPolicy,
      }
    : null;

  const activeDirectorsBefore = await prisma.infoSpotUserRole.count({
    where: { role: "INFOSPOT_DIRECTOR", status: "ACTIVE" },
  });

  await prisma.infoSpotUserRole.upsert({
    where: { userId: user.id },
    update: {
      role: "INFOSPOT_DIRECTOR",
      status: "ACTIVE",
      canPublish: true,
      publicationPolicy: "DIRECT_PUBLISH",
    },
    create: {
      userId: user.id,
      role: "INFOSPOT_DIRECTOR",
      status: "ACTIVE",
      canPublish: true,
      publicationPolicy: "DIRECT_PUBLISH",
    },
  });

  // Ensure settings + categories exist (idempotent, no demo content).
  const existingSettings = await prisma.infoSpotSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!existingSettings) {
    await prisma.infoSpotSettings.create({
      data: {
        siteName: "Info Spot",
        slogan: "Descubrí lo que está pasando cerca tuyo.",
        seoTitle: "Info Spot",
        seoDescription:
          "Medio digital argentino dedicado a la cobertura, difusión y comunicación de eventos deportivos, culturales y sociales.",
      },
    });
  }

  for (const category of [
    { name: "Deportes", slug: "deportes", description: "Cobertura deportiva y agenda." },
    { name: "Cultura", slug: "cultura", description: "Cultura, arte y agenda social." },
    { name: "Fotografía", slug: "fotografia", description: "Fotografía, autores y oficio." },
    { name: "Eventos", slug: "eventos", description: "Eventos cerca tuyo." },
  ] as const) {
    await prisma.infoSpotCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: { ...category },
    });
  }

  console.log(
    JSON.stringify({
      ok: true,
      userId: user.id,
      emailMasked: maskEmail(email),
      suiteRolePreserved: user.role,
      previousInfoSpotRole: previous,
      nextInfoSpotRole: {
        role: "INFOSPOT_DIRECTOR",
        status: "ACTIVE",
        canPublish: true,
        publicationPolicy: "DIRECT_PUBLISH",
      },
      activeDirectorsBefore,
      actor: "db:grant-infospot-director",
      at: new Date().toISOString(),
    }),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
