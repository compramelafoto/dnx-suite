/**
 * Taxonomía inicial del blog Clickatón (CMS ETAPA 06).
 *
 *   pnpm --filter clickaton seed:clickaton-blog-taxonomy -- --confirm
 *   pnpm --filter clickaton seed:clickaton-blog-taxonomy -- --confirm --with-fixture
 *
 * `DATABASE_URL` debe venir de `apps/compramelafoto/.env.preview.local` (staging).
 *
 * - Solo staging (ep-round-fog); aborta contra cualquier otra base.
 * - Idempotente: upsert por `platform_slug`.
 * - Sin `--with-fixture` no crea ninguna nota, solo categorías + autor.
 */
import { pathToFileURL } from "node:url";
import { prisma } from "@repo/db";
import { generateContentHtml, calculateReadingTimeFromContentJson } from "@repo/content";
import type { Prisma } from "@prisma/client";
import { assertStagingDatabaseUrl } from "./lib/assert-staging-database-url";

const PLATFORM = "clickaton" as const;

const CATEGORIES = [
  {
    slug: "guias",
    name: "Guías",
    description:
      "Cómo participar de una Clickatón: inscripción, consignas, entrega y buenas prácticas.",
    sortOrder: 10,
    isFeatured: true,
  },
  {
    slug: "novedades",
    name: "Novedades",
    description: "Anuncios de nuevas ediciones, sedes, premios y alianzas.",
    sortOrder: 20,
    isFeatured: false,
  },
  {
    slug: "historias-de-sede",
    name: "Historias de sede",
    description: "Lo que pasa en cada ciudad: organizadores, comunidad y fotos que quedan.",
    sortOrder: 30,
    isFeatured: false,
  },
  {
    slug: "fotografia",
    name: "Fotografía",
    description: "Mirada, técnica y recursos para mirar mejor antes de salir a la calle.",
    sortOrder: 40,
    isFeatured: false,
  },
] as const;

const AUTHOR = {
  slug: "equipo-clickaton",
  name: "Equipo Clickatón",
  role: "Equipo Clickatón",
  bio: "El equipo que organiza las maratones fotográficas de Clickatón en cada ciudad.",
} as const;

const TAGS = [
  { slug: "inscripcion", name: "Inscripción" },
  { slug: "consignas", name: "Consignas" },
  { slug: "premios", name: "Premios" },
  { slug: "comunidad", name: "Comunidad" },
] as const;

const FIXTURE_SLUG = "que-es-clickaton-como-funciona-maraton-fotografica";
const FIXTURE_TAG_SLUGS = ["inscripcion", "consignas"] as const;

const FIXTURE_CONTENT = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Clickatón es una maratón fotográfica: una jornada en la que cientos de personas recorren la misma ciudad con la cámara, resolviendo consignas que se revelan el mismo día.",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Cómo funciona" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Te inscribís en una sede, retirás tu kit y recibís las consignas. Tenés la jornada completa para fotografiar y, al cierre, elegís las fotos que entregás a jurado.",
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Una jornada, una ciudad, consignas sorpresa." }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Cualquier cámara sirve: celular, compacta o réflex." },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Jurado, premios y muestra de las obras." }],
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Para quién es" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Para quien recién empieza y para quien vive de la fotografía. La consigna iguala: todos salen a buscar el mismo instante en la misma ciudad y el mismo día.",
        },
      ],
    },
  ],
} satisfies Record<string, unknown>;

export type BlogTaxonomySeedResult = {
  ok: true;
  environment: "staging";
  hostHint: string;
  platform: typeof PLATFORM;
  categories: number;
  tags: number;
  author: string;
  fixture: { created: boolean; slug: string | null; status: string | null };
};

export async function seedClickatonBlogTaxonomy(options?: {
  withFixture?: boolean;
}): Promise<BlogTaxonomySeedResult> {
  const db = assertStagingDatabaseUrl();
  if (!db.ok) throw new Error(db.message);

  for (const category of CATEGORIES) {
    await prisma.blogCategory.upsert({
      where: { platform_slug: { platform: PLATFORM, slug: category.slug } },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isFeatured: category.isFeatured,
      },
      create: { platform: PLATFORM, ...category },
    });
  }

  for (const tag of TAGS) {
    await prisma.blogTag.upsert({
      where: { platform_slug: { platform: PLATFORM, slug: tag.slug } },
      update: { name: tag.name },
      create: { platform: PLATFORM, ...tag },
    });
  }

  const author = await prisma.blogAuthor.upsert({
    where: { platform_slug: { platform: PLATFORM, slug: AUTHOR.slug } },
    update: { name: AUTHOR.name, role: AUTHOR.role, bio: AUTHOR.bio, isActive: true },
    create: { platform: PLATFORM, ...AUTHOR, isActive: true },
  });

  let fixture: BlogTaxonomySeedResult["fixture"] = {
    created: false,
    slug: null,
    status: null,
  };

  if (options?.withFixture) {
    const category = await prisma.blogCategory.findUniqueOrThrow({
      where: { platform_slug: { platform: PLATFORM, slug: "guias" } },
      select: { id: true },
    });
    const contentHtml = await generateContentHtml(FIXTURE_CONTENT);
    const readingTimeMin = calculateReadingTimeFromContentJson(FIXTURE_CONTENT);
    const publishedAt = new Date();

    const post = await prisma.blogPost.upsert({
      where: { platform_slug: { platform: PLATFORM, slug: FIXTURE_SLUG } },
      update: {
        contentJson: FIXTURE_CONTENT as Prisma.InputJsonValue,
        contentHtml,
        readingTimeMin,
        status: "PUBLISHED",
      },
      create: {
        platform: PLATFORM,
        slug: FIXTURE_SLUG,
        title: "Qué es Clickatón y cómo funciona una maratón fotográfica",
        excerpt:
          "Una jornada, una ciudad y consignas que se revelan el mismo día. Así funciona una Clickatón, de la inscripción a la entrega.",
        contentJson: FIXTURE_CONTENT as Prisma.InputJsonValue,
        contentHtml,
        readingTimeMin,
        status: "PUBLISHED",
        type: "BLOG",
        publishedAt,
        categoryId: category.id,
        authorId: author.id,
        seoDescription:
          "Guía rápida de Clickatón: qué es una maratón fotográfica, cómo se participa y qué pasa el día de la jornada.",
        noIndex: false,
      },
      select: { id: true, slug: true, status: true },
    });

    // Etiquetas de la nota: sincronización idempotente contra FIXTURE_TAG_SLUGS.
    const fixtureTags = await prisma.blogTag.findMany({
      where: { platform: PLATFORM, slug: { in: [...FIXTURE_TAG_SLUGS] } },
      select: { id: true },
    });
    await prisma.blogPostTag.deleteMany({
      where: { postId: post.id, tagId: { notIn: fixtureTags.map((t) => t.id) } },
    });
    await prisma.blogPostTag.createMany({
      data: fixtureTags.map((tag) => ({ postId: post.id, tagId: tag.id })),
      skipDuplicates: true,
    });

    fixture = { created: true, slug: post.slug, status: post.status };
  }

  return {
    ok: true,
    environment: "staging",
    hostHint: db.hostHint,
    platform: PLATFORM,
    categories: CATEGORIES.length,
    tags: TAGS.length,
    author: author.slug,
    fixture,
  };
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "Escritura real en la base: repetí el comando con --confirm (y DATABASE_URL de staging).",
    );
    process.exit(1);
  }
  const withFixture = process.argv.includes("--with-fixture");
  const result = await seedClickatonBlogTaxonomy({ withFixture });
  console.log(JSON.stringify(result, null, 2));
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
