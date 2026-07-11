/**
 * Seed demo de noticias Info Spot — SOLO staging/desarrollo.
 *
 * Bloqueado si NODE_ENV=production salvo ALLOW_INFOSPOT_DEMO_SEED=1.
 *
 * Uso:
 *   pnpm --filter @repo/db exec tsx prisma/scripts/seed-infospot-demo-articles.ts
 */
import { prisma } from "../../src/client.js";

const DIRECTOR_EMAIL = process.env.INFOSPOT_DIRECTOR_EMAIL?.trim() || "cuart.daniel@gmail.com";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_INFOSPOT_DEMO_SEED !== "1") {
  console.error("Bloqueado en production. Set ALLOW_INFOSPOT_DEMO_SEED=1 solo si es intencional.");
  process.exit(1);
}

const demos = [
  {
    title: "Arranca Info Spot en la escena local",
    slug: "arranca-info-spot-escena-local",
    excerpt: "El medio digital ya tiene redacción y portada pública para coberturas cercanas.",
    content:
      "## Bienvenida\n\nInfo Spot nace para contar **lo que pasa cerca tuyo**: deporte, cultura y eventos sociales.\n\nEsta nota es de demostración para staging.",
    categorySlug: "eventos",
  },
  {
    title: "Agenda deportiva del fin de semana",
    slug: "agenda-deportiva-fin-de-semana",
    excerpt: "Partidos, torneos y encuentros amateur para seguir de cerca.",
    content:
      "La redacción prepara coberturas deportivas con foco local.\n\n- Fútbol barrial\n- Running\n- Torneos escolares",
    categorySlug: "deportes",
  },
  {
    title: "Cultura en la plaza: feria y música en vivo",
    slug: "cultura-plaza-feria-musica",
    excerpt: "Una jornada cultural reúne artesanos, bandas y familias.",
    content:
      "### Crónica breve\n\nLa plaza se llenó de color. Info Spot documentará estas escenas con mirada editorial.",
    categorySlug: "cultura",
  },
  {
    title: "Fotografía de eventos: tips para cubrir sin molestar",
    slug: "fotografia-eventos-tips",
    excerpt: "Consejos básicos de cobertura respetuosa en eventos sociales.",
    content:
      "Trabajá con luz disponible, pedí permiso cuando haga falta y priorizá la historia sobre el disparo.\n\n> El oficio también es empatía.",
    categorySlug: "fotografia",
  },
  {
    title: "Qué eventos mirar esta semana",
    slug: "que-eventos-mirar-esta-semana",
    excerpt: "Selección editorial de agenda para no perderte nada.",
    content:
      "Esta semana destacamos encuentros culturales y deportivos de cercanía.\n\nVolvé a Info Spot para más coberturas.",
    categorySlug: "eventos",
  },
] as const;

async function main() {
  const author = await prisma.user.findUnique({
    where: { email: DIRECTOR_EMAIL },
    select: { id: true, email: true },
  });
  if (!author) {
    throw new Error(`No existe User ${DIRECTOR_EMAIL}. Corré antes db:seed:infospot.`);
  }

  for (const demo of demos) {
    const category = await prisma.infoSpotCategory.findUnique({
      where: { slug: demo.categorySlug },
      select: { id: true },
    });
    await prisma.infoSpotArticle.upsert({
      where: { slug: demo.slug },
      update: {
        title: demo.title,
        excerpt: demo.excerpt,
        content: demo.content,
        categoryId: category?.id ?? null,
        status: "PUBLISHED",
        publishedAt: new Date(),
        contentTag: "DEMO",
      },
      create: {
        title: demo.title,
        slug: demo.slug,
        excerpt: demo.excerpt,
        content: demo.content,
        categoryId: category?.id ?? null,
        authorId: author.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
        contentTag: "DEMO",
      },
    });
  }

  console.log(`Demo OK: ${demos.length} noticias publicadas (autor ${author.email}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
