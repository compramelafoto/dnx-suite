/**
 * Fixtures editoriales de lanzamiento — BORRADORES DEMO (nunca publicados).
 *
 * Pensado para staging / ensayos de redacción. No publica en home.
 * Bloqueado en production salvo ALLOW_INFOSPOT_DEMO_SEED=1.
 *
 * Prerrequisito: pnpm --filter @repo/db db:seed:infospot
 *
 * Uso:
 *   pnpm --filter @repo/db db:seed:infospot-launch-drafts
 */
import { prisma } from "../../src/client.js";

const DIRECTOR_EMAIL =
  process.env.INFOSPOT_DIRECTOR_EMAIL?.trim() || "cuart.daniel@gmail.com";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_INFOSPOT_DEMO_SEED !== "1") {
  console.error(
    "Bloqueado en production. Set ALLOW_INFOSPOT_DEMO_SEED=1 solo si es intencional.",
  );
  process.exit(1);
}

function daysFromNow(days: number, hour = 18): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Slugs reservados — no publicar sin revisión humana. */
export const LAUNCH_DRAFT_ARTICLE_SLUGS = [
  "draft-demo-banner-home",
  "draft-demo-cobertura-deportes",
  "draft-demo-ultima-noticia-cultura",
  "draft-demo-fotografia-galeria",
] as const;

export const LAUNCH_DRAFT_EVENT_SLUGS = [
  "draft-demo-evento-destacado",
  "draft-demo-buscan-fotografos",
  "draft-demo-agenda-proximos",
] as const;

const articles = [
  {
    slug: "draft-demo-banner-home",
    title: "[DEMO] Portada: la historia que abre el día",
    excerpt:
      "Borrador para ensayar el banner de home. Completar con hechos verificados antes de publicar.",
    content: `## Borrador de portada

Este texto es un **fixture DEMO** en estado borrador.

- No debe publicarse sin checklist completo.
- Sirve para probar jerarquía de home (banner / destacados).
- Reemplazar por cobertura REAL el día del lanzamiento.

### Crédito

Pendiente de fotografía autorizada.`,
    categorySlug: "eventos",
    editorialPriority: 80,
  },
  {
    slug: "draft-demo-cobertura-deportes",
    title: "[DEMO] Cobertura deportiva — pendiente de material",
    excerpt: "Plantilla de cobertura con espacio para fotos de CompraMeLaFoto.",
    content: `## Cobertura

1. Vincular evento.
2. Preparar material en el asistente.
3. Insertar fotos desde la biblioteca.
4. Completar crédito y alt text.`,
    categorySlug: "deportes",
    editorialPriority: 40,
  },
  {
    slug: "draft-demo-ultima-noticia-cultura",
    title: "[DEMO] Últimas noticias — cultura local",
    excerpt: "Nota corta para el bloque «Últimas noticias» una vez publicada.",
    content: `Crónica breve de ejemplo. Sustituir por hechos reales y fuentes nombradas.`,
    categorySlug: "cultura",
    editorialPriority: 20,
  },
  {
    slug: "draft-demo-fotografia-galeria",
    title: "[DEMO] Galería fotográfica — oficio y autor",
    excerpt: "Pieza para ensayar créditos, portada y galería.",
    content: `## Mirada

Ensayo de estructura con énfasis en crédito fotográfico y CTA al álbum cuando exista cobertura.`,
    categorySlug: "fotografia",
    editorialPriority: 10,
  },
] as const;

const events = [
  {
    slug: "draft-demo-evento-destacado",
    title: "[DEMO] Evento destacado de agenda",
    summary: "Borrador para el bloque de eventos destacados.",
    description:
      "Descripción de ensayo. Completar organizador real, geo confirmada y portada antes de publicar.",
    categorySlug: "eventos",
    organizerName: "Organizador DEMO",
    organizerEmail: "demo-destacado@example.com",
    city: "Rosario",
    province: "Santa Fe",
    venueName: "Venue a confirmar",
    latitude: -32.9442,
    longitude: -60.6505,
    startAt: daysFromNow(14, 17),
    endAt: daysFromNow(14, 21),
    editorialPriority: 70,
  },
  {
    slug: "draft-demo-buscan-fotografos",
    title: "[DEMO] Convocatoria — buscan fotógrafos",
    summary: "Evento de ensayo para el bloque «Buscan fotógrafos».",
    description:
      "Convocatoria DEMO. Al publicar de verdad, sincronizar con CLF y verificar cupos/términos.",
    categorySlug: "fotografia",
    organizerName: "Productora DEMO",
    organizerEmail: "demo-fotografos@example.com",
    city: "Córdoba",
    province: "Córdoba",
    venueName: "Predio a confirmar",
    latitude: -31.4201,
    longitude: -64.1888,
    startAt: daysFromNow(21, 10),
    endAt: daysFromNow(21, 20),
    editorialPriority: 50,
  },
  {
    slug: "draft-demo-agenda-proximos",
    title: "[DEMO] Próximo en agenda",
    summary: "Fixture para el listado de próximos eventos.",
    description: "Evento de relleno editorial. No publicar sin fechas y ubicación confirmadas.",
    categorySlug: "deportes",
    organizerName: "Club DEMO",
    organizerEmail: "demo-agenda@example.com",
    city: "Santa Fe",
    province: "Santa Fe",
    venueName: "Cancha municipal",
    latitude: -31.6333,
    longitude: -60.7,
    startAt: daysFromNow(7, 16),
    endAt: daysFromNow(7, 18),
    editorialPriority: 30,
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

  for (const a of articles) {
    const category = await prisma.infoSpotCategory.findUnique({
      where: { slug: a.categorySlug },
      select: { id: true },
    });
    await prisma.infoSpotArticle.upsert({
      where: { slug: a.slug },
      update: {
        title: a.title,
        excerpt: a.excerpt,
        content: a.content,
        categoryId: category?.id ?? null,
        status: "DRAFT",
        publishedAt: null,
        contentTag: "DEMO",
        editorialPriority: a.editorialPriority,
        excludeFromHomepage: false,
      },
      create: {
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        content: a.content,
        categoryId: category?.id ?? null,
        authorId: author.id,
        status: "DRAFT",
        publishedAt: null,
        contentTag: "DEMO",
        editorialPriority: a.editorialPriority,
        excludeFromHomepage: false,
      },
    });
  }

  for (const e of events) {
    const category = await prisma.infoSpotCategory.findUnique({
      where: { slug: e.categorySlug },
      select: { id: true },
    });
    await prisma.infoSpotEvent.upsert({
      where: { slug: e.slug },
      update: {
        title: e.title,
        summary: e.summary,
        description: e.description,
        categoryId: category?.id ?? null,
        organizerName: e.organizerName,
        organizerEmail: e.organizerEmail,
        city: e.city,
        province: e.province,
        venueName: e.venueName,
        latitude: e.latitude,
        longitude: e.longitude,
        startAt: e.startAt,
        endAt: e.endAt,
        status: "DRAFT",
        publishedAt: null,
        contentTag: "DEMO",
        editorialPriority: e.editorialPriority,
        excludeFromHomepage: false,
        locationConfirmedAt: new Date(),
        geocodingStatus: "CONFIRMED",
        authorId: author.id,
      },
      create: {
        title: e.title,
        slug: e.slug,
        summary: e.summary,
        description: e.description,
        categoryId: category?.id ?? null,
        organizerName: e.organizerName,
        organizerEmail: e.organizerEmail,
        city: e.city,
        province: e.province,
        venueName: e.venueName,
        latitude: e.latitude,
        longitude: e.longitude,
        startAt: e.startAt,
        endAt: e.endAt,
        authorId: author.id,
        status: "DRAFT",
        publishedAt: null,
        contentTag: "DEMO",
        editorialPriority: e.editorialPriority,
        excludeFromHomepage: false,
        locationConfirmedAt: new Date(),
        geocodingStatus: "CONFIRMED",
        originKind: "REDACCION",
      },
    });
  }

  console.log(
    `Launch drafts OK: ${articles.length} noticias + ${events.length} eventos en DRAFT (DEMO). Autor ${author.email}.`,
  );
  console.log("No publicados. Revisar en /redaccion y completar antes de publicar.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
