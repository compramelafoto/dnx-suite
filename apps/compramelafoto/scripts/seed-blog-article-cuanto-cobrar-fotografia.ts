/**
 * Crea o actualiza el artículo «¿Cuánto cobrar por un trabajo de fotografía?» (PUBLISHED).
 * Ejecutar: npm run seed:blog:cuanto-cobrar-fotografia
 */

import { BlogPostStatus, PrismaClient } from "@prisma/client";

import { CLF_CONTENT_PLATFORM } from "../lib/blog/content-platform";
import { HERRAMIENTAS_ARTICLES } from "@/data/blog/phase7/catalog-herramientas";
import { preparePhase8Article } from "@/data/blog/phase8/prepare-phase8";
import { syncBlogPostImageFields } from "@/lib/blog/blog-post-images";
import { slugifyBlogFromName } from "@/lib/blog/slugify-blog";
import { ensureSingleFeaturedBlogPost } from "@/lib/blog/unset-other-featured";

const SLUG = "cuanto-cobrar-fotografia";
const HERO_IMAGE_PATH = "/images/blog/cuanto-cobrar-fotografia-hero.png";
const AUTHOR_SLUG = "equipo-compramelafoto";
const CATEGORY_SLUG = "herramientas-para-fotografos";

const prisma = new PrismaClient();

async function main() {
  const draft = HERRAMIENTAS_ARTICLES.find((article) => article.slug === SLUG);
  if (!draft) {
    throw new Error(`No se encontró el borrador en catálogo: ${SLUG}`);
  }

  const category = await prisma.blogCategory.upsert({
    where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: CATEGORY_SLUG } },
    update: {
      name: "Herramientas para Fotógrafos",
      description:
        "Calculadoras, presupuestos y recursos para profesionalizar tu negocio fotográfico.",
    },
    create: {
      platform: CLF_CONTENT_PLATFORM,
      name: "Herramientas para Fotógrafos",
      slug: CATEGORY_SLUG,
      description:
        "Calculadoras, presupuestos y recursos para profesionalizar tu negocio fotográfico.",
      sortOrder: 5,
      isFeatured: false,
    },
    select: { id: true },
  });

  const author =
    (await prisma.blogAuthor.upsert({
      where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: AUTHOR_SLUG } },
      update: { name: "Comprame la Foto" },
      create: {
        platform: CLF_CONTENT_PLATFORM,
        name: "Comprame la Foto",
        slug: AUTHOR_SLUG,
        role: "Equipo CLF",
        bio: "Notas editoriales del equipo de ComprameLaFoto.",
        isActive: true,
      },
    })) ??
    (await prisma.blogAuthor.findFirst({
      where: { platform: CLF_CONTENT_PLATFORM, isActive: true },
      orderBy: { id: "asc" },
    }));

  const prepared = await preparePhase8Article(draft);
  const images = syncBlogPostImageFields({
    heroImageUrl: HERO_IMAGE_PATH,
    ogImageUrl: HERO_IMAGE_PATH,
  });

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

  const now = new Date();

  const post = await prisma.blogPost.upsert({
    where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: SLUG } },
    update: {
      title: prepared.title,
      excerpt: prepared.excerpt,
      contentJson: prepared.contentJson,
      contentHtml: prepared.contentHtml,
      readingTimeMin: prepared.readingTimeMin,
      status: BlogPostStatus.PUBLISHED,
      type: prepared.type,
      seoTitle: prepared.seoTitle,
      seoDescription: prepared.seoDescription,
      seoGoal: prepared.seoGoal,
      isFeatured: false,
      categoryId: category.id,
      authorId: author?.id ?? null,
      heroImageUrl: images.heroImageUrl,
      ogImageUrl: images.ogImageUrl,
      publishedAt: now,
      lastReviewedAt: now,
      noIndex: false,
    },
    create: {
      platform: CLF_CONTENT_PLATFORM,
      title: prepared.title,
      slug: SLUG,
      excerpt: prepared.excerpt,
      contentJson: prepared.contentJson,
      contentHtml: prepared.contentHtml,
      readingTimeMin: prepared.readingTimeMin,
      status: BlogPostStatus.PUBLISHED,
      type: prepared.type,
      seoTitle: prepared.seoTitle,
      seoDescription: prepared.seoDescription,
      seoGoal: prepared.seoGoal,
      isFeatured: false,
      categoryId: category.id,
      authorId: author?.id ?? null,
      heroImageUrl: images.heroImageUrl,
      ogImageUrl: images.ogImageUrl,
      publishedAt: now,
      lastReviewedAt: now,
      noIndex: false,
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

  console.log(`✅ PUBLICADO: ${prepared.title}`);
  console.log(`   Slug: ${SLUG}`);
  console.log(`   Categoría: ${CATEGORY_SLUG}`);
  console.log(`   Lectura: ~${prepared.readingTimeMin} min`);
  console.log(`   Hero: ${HERO_IMAGE_PATH}`);
  console.log(`   Admin: /admin/blog/${post.id}`);
  console.log(`   Público: /blog/${SLUG}`);
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
