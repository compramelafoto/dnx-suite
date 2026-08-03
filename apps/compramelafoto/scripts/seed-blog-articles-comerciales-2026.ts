/**
 * Crea o actualiza artículos editoriales comerciales (DRAFT):
 * - vende-fotos-sin-suscripcion-mensual
 * - encontrar-fotos-con-selfie
 * - como-protegemos-datos-privacidad
 * - como-conseguir-eventos-y-clientes-como-fotografo
 *
 * Ejecutar: npm run seed:blog:comerciales-2026
 */

import { BlogPostStatus, PrismaClient } from "@prisma/client";

import { CLF_CONTENT_PLATFORM } from "../lib/blog/content-platform";
import { FUNCIONALIDADES_ARTICLES } from "@/data/blog/phase7/catalog-funcionalidades";
import { NEGOCIO_ARTICLES } from "@/data/blog/phase7/catalog-negocio";
import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";
import { preparePhase8Article } from "@/data/blog/phase8/prepare-phase8";
import { slugifyBlogFromName } from "@/lib/blog/slugify-blog";
import { ensureSingleFeaturedBlogPost } from "@/lib/blog/unset-other-featured";

const SLUGS = [
  "vende-fotos-sin-suscripcion-mensual",
  "encontrar-fotos-con-selfie",
  "como-protegemos-datos-privacidad",
  "como-conseguir-eventos-y-clientes-como-fotografo",
] as const;

const ALL_DRAFTS: Phase7ArticleDraft[] = [...NEGOCIO_ARTICLES, ...FUNCIONALIDADES_ARTICLES];

const prisma = new PrismaClient();

async function seedArticle(slug: (typeof SLUGS)[number]) {
  const draft = ALL_DRAFTS.find((a) => a.slug === slug);
  if (!draft) {
    throw new Error(`No se encontró el borrador en catálogo: ${slug}`);
  }

  const category = await prisma.blogCategory.findUnique({
    where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: draft.categorySlug } },
    select: { id: true },
  });
  if (!category) {
    throw new Error(`Categoría no encontrada: ${draft.categorySlug}`);
  }

  const author =
    (await prisma.blogAuthor.findUnique({ where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: "equipo-compramelafoto" } } })) ??
    (await prisma.blogAuthor.findFirst({
      where: { platform: CLF_CONTENT_PLATFORM, isActive: true },
      orderBy: { id: "asc" },
    }));

  const prepared = await preparePhase8Article(draft);
  const tagIds: number[] = [];
  for (const name of draft.tags) {
    const tagSlug = slugifyBlogFromName(name);
    const tag = await prisma.blogTag.upsert({
      where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: tagSlug } },
      update: { name },
      create: { platform: CLF_CONTENT_PLATFORM, name, slug: tagSlug },
    });
    tagIds.push(tag.id);
  }

  const post = await prisma.blogPost.upsert({
    where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug } },
    update: {
      title: prepared.title,
      excerpt: prepared.excerpt,
      contentJson: prepared.contentJson,
      contentHtml: prepared.contentHtml,
      readingTimeMin: prepared.readingTimeMin,
      status: BlogPostStatus.DRAFT,
      type: prepared.type,
      seoTitle: prepared.seoTitle,
      seoDescription: prepared.seoDescription,
      seoGoal: prepared.seoGoal,
      isFeatured: false,
      categoryId: category.id,
      authorId: author?.id ?? null,
    },
    create: {
      platform: CLF_CONTENT_PLATFORM,
      title: prepared.title,
      slug,
      excerpt: prepared.excerpt,
      contentJson: prepared.contentJson,
      contentHtml: prepared.contentHtml,
      readingTimeMin: prepared.readingTimeMin,
      status: BlogPostStatus.DRAFT,
      type: prepared.type,
      seoTitle: prepared.seoTitle,
      seoDescription: prepared.seoDescription,
      seoGoal: prepared.seoGoal,
      isFeatured: false,
      categoryId: category.id,
      authorId: author?.id ?? null,
      heroImageUrl: null,
      ogImageUrl: null,
    },
  });

  await prisma.blogPostTag.deleteMany({ where: { postId: post.id } });
  if (tagIds.length > 0) {
    await prisma.blogPostTag.createMany({
      data: tagIds.map((tagId) => ({ postId: post.id, tagId })),
      skipDuplicates: true,
    });
  }

  await ensureSingleFeaturedBlogPost(prisma, post.id, false);

  console.log(`✅ DRAFT: ${prepared.title}`);
  console.log(`   Slug: ${slug}`);
  console.log(`   Lectura: ~${prepared.readingTimeMin} min`);
  console.log(`   Admin: /admin/blog/${post.id}`);
}

async function main() {
  for (const slug of SLUGS) {
    await seedArticle(slug);
  }
  console.log(`\nListo: ${SLUGS.length} artículos en estado DRAFT.`);
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
