/**
 * Crea borradores plantilla REAL (no publicados) para la cola de lanzamiento.
 * No inventa hechos periodísticos: solo títulos provisionales + checklist de fuentes.
 *
 * Uso: pnpm --filter @repo/db exec tsx scripts/infospot-seed-launch-templates.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DIRECTOR_EMAIL =
  process.env.INFOSPOT_DIRECTOR_EMAIL?.trim() || "cuart.daniel@gmail.com";

const TEMPLATES = [
  {
    slug: "plantilla-deportes-cobertura-local",
    categorySlug: "deportes",
    title: "[PENDIENTE] Cobertura deportiva local — [COMPLETAR evento]",
    excerpt:
      "[COMPLETAR] Bajada factual del encuentro deportivo. Incluir localidad y fecha del acontecimiento.",
    sourceChecklist: "Acta / organizador / club / redes oficiales del torneo",
  },
  {
    slug: "plantilla-deportes-running",
    categorySlug: "deportes",
    title: "[PENDIENTE] Carrera / running — [COMPLETAR nombre]",
    excerpt: "[COMPLETAR] Distancia, sede y fecha. Sin inventar tiempos ni ganadores.",
    sourceChecklist: "Organizador de la carrera / resultados oficiales",
  },
  {
    slug: "plantilla-cultura-feria",
    categorySlug: "cultura",
    title: "[PENDIENTE] Feria o muestra cultural — [COMPLETAR]",
    excerpt: "[COMPLETAR] Qué se exhibió, dónde y cuándo. Sin valoraciones inventadas.",
    sourceChecklist: "Municipalidad / productora / convocatoria oficial",
  },
  {
    slug: "plantilla-cultura-musica",
    categorySlug: "cultura",
    title: "[PENDIENTE] Música en vivo — [COMPLETAR artista/evento]",
    excerpt: "[COMPLETAR] Fecha, venue y ciudad. Sin reseñas inventadas.",
    sourceChecklist: "Productora / venue / gacetilla de prensa",
  },
  {
    slug: "plantilla-fotografia-cobertura",
    categorySlug: "fotografia",
    title: "[PENDIENTE] Mirada fotográfica — [COMPLETAR cobertura]",
    excerpt: "[COMPLETAR] Contexto de la cobertura y crédito del fotógrafo.",
    sourceChecklist: "Fotógrafo / álbum CLF / autorización de uso editorial",
  },
  {
    slug: "plantilla-eventos-agenda",
    categorySlug: "eventos",
    title: "[PENDIENTE] Agenda de eventos — [COMPLETAR zona/fecha]",
    excerpt: "[COMPLETAR] Solo eventos verificados con fuente. No listar sin confirmación.",
    sourceChecklist: "Organizadores / municipios / agendas oficiales",
  },
  {
    slug: "plantilla-eventos-comunitario",
    categorySlug: "eventos",
    title: "[PENDIENTE] Evento comunitario — [COMPLETAR]",
    excerpt: "[COMPLETAR] Quién organiza, dónde y cuándo. Sin cifras inventadas de asistencia.",
    sourceChecklist: "Organizador / convocatoria pública",
  },
  {
    slug: "plantilla-deportes-amateur",
    categorySlug: "deportes",
    title: "[PENDIENTE] Torneo amateur — [COMPLETAR disciplina]",
    excerpt: "[COMPLETAR] Categorías y sede. Resultados solo con fuente oficial.",
    sourceChecklist: "Liga / federación / club organizador",
  },
] as const;

function buildContent(t: (typeof TEMPLATES)[number]): string {
  return `# ${t.title}

## Qué cubrimos

[COMPLETAR POR REDACCIÓN — solo con fuente verificada]

## Datos del acontecimiento

- **Fecha del hecho:** [COMPLETAR]
- **Localidad:** [COMPLETAR]
- **Fuente pendiente:** ${t.sourceChecklist}

## Desarrollo

[COMPLETAR POR REDACCIÓN]

## Cobertura fotográfica

[COMPLETAR crédito y selección — o usar fallback de categoría identificado]

---

> Plantilla de lanzamiento Info Spot. No publicar sin fuente, fact-check y título definitivo.
`;
}

async function main() {
  const author = await prisma.user.findUnique({
    where: { email: DIRECTOR_EMAIL },
    select: { id: true },
  });
  if (!author) throw new Error(`No existe User ${DIRECTOR_EMAIL}`);

  let created = 0;
  let skipped = 0;

  for (const t of TEMPLATES) {
    const existing = await prisma.infoSpotArticle.findUnique({
      where: { slug: t.slug },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    const category = await prisma.infoSpotCategory.findUnique({
      where: { slug: t.categorySlug },
      select: { id: true },
    });
    await prisma.infoSpotArticle.create({
      data: {
        title: t.title,
        slug: t.slug,
        excerpt: t.excerpt,
        content: buildContent(t),
        categoryId: category?.id ?? null,
        authorId: author.id,
        status: "DRAFT",
        contentTag: "REAL",
        sourceName: null,
        sourceUrl: null,
        seoTitle: null,
        seoDescription: null,
      },
    });
    created += 1;
  }

  console.log(JSON.stringify({ created, skipped, totalTemplates: TEMPLATES.length }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
