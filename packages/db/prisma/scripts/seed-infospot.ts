/**
 * Seed opcional solo de Info Spot (settings + categorías + rol DIRECTOR de ejemplo).
 *
 * Uso desde la raíz del monorepo:
 *   pnpm --filter @repo/db exec tsx prisma/scripts/seed-infospot.ts
 *
 * Variables:
 *   INFOSPOT_DIRECTOR_EMAIL  (default: cuart.daniel@gmail.com)
 *   INFOSPOT_REDACTOR_EMAIL  (opcional)
 */
import { prisma } from "../../src/client.js";

const DIRECTOR_EMAIL = process.env.INFOSPOT_DIRECTOR_EMAIL?.trim() || "cuart.daniel@gmail.com";
const REDACTOR_EMAIL = process.env.INFOSPOT_REDACTOR_EMAIL?.trim() || "";

async function main() {
  const director = await prisma.user.findUnique({
    where: { email: DIRECTOR_EMAIL },
    select: { id: true, email: true },
  });
  if (!director) {
    throw new Error(
      `No existe User con email ${DIRECTOR_EMAIL}. Creá el usuario o pasá INFOSPOT_DIRECTOR_EMAIL.`,
    );
  }

  let redactorId: number | undefined;
  if (REDACTOR_EMAIL) {
    const redactor = await prisma.user.findUnique({
      where: { email: REDACTOR_EMAIL },
      select: { id: true },
    });
    if (!redactor) {
      throw new Error(`No existe User con email ${REDACTOR_EMAIL}.`);
    }
    redactorId = redactor.id;
  }

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

  await prisma.infoSpotUserRole.upsert({
    where: { userId: director.id },
    update: { role: "INFOSPOT_DIRECTOR", canPublish: true, status: "ACTIVE" },
    create: {
      userId: director.id,
      role: "INFOSPOT_DIRECTOR",
      canPublish: true,
      status: "ACTIVE",
    },
  });

  if (redactorId) {
    await prisma.infoSpotUserRole.upsert({
      where: { userId: redactorId },
      update: { role: "INFOSPOT_REDACTOR", canPublish: true, status: "ACTIVE" },
      create: {
        userId: redactorId,
        role: "INFOSPOT_REDACTOR",
        canPublish: true,
        status: "ACTIVE",
      },
    });
  }

  console.log(`Info Spot seed OK. DIRECTOR → ${director.email}${redactorId ? `; REDACTOR → ${REDACTOR_EMAIL}` : ""}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
