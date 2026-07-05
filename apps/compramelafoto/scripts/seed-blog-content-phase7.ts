/**
 * Seed Fase 7: borradores estratégicos del blog + categorías/tags + prompts de imagen.
 * Ejecutar: npm run seed:blog:content
 *
 * Idempotente por slug. No publica artículos (status DRAFT).
 * No genera imágenes; los prompts viven en BlogPost.seoGoal (JSON imagePlan).
 */

import { BlogPostStatus, PrismaClient } from "@prisma/client";
import {
  PHASE7_ALL_ARTICLES,
  PHASE7_ARTICLE_COUNT,
  PHASE7_CATEGORIES,
  PHASE7_TAGS,
  prepareDraftForSeed,
} from "@/data/blog/phase7";
import { ensureSingleFeaturedBlogPost } from "@/lib/blog/unset-other-featured";

const prisma = new PrismaClient();

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function seedCategories() {
  console.log("Categorías Fase 7:");
  for (const category of PHASE7_CATEGORIES) {
    await prisma.blogCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isFeatured: category.isFeatured ?? false,
      },
      create: category,
    });
    console.log(`  ✓ ${category.name} (${category.slug})`);
  }
}

async function seedTags() {
  console.log("\nTags Fase 7:");
  for (const name of PHASE7_TAGS) {
    const slug = slugFromName(name);
    await prisma.blogTag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    console.log(`  ✓ ${name}`);
  }
}

async function resolveAuthorId(): Promise<number | null> {
  const author =
    (await prisma.blogAuthor.findUnique({ where: { slug: "equipo-compramelafoto" } })) ??
    (await prisma.blogAuthor.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }));
  return author?.id ?? null;
}

async function seedArticles() {
  const authorId = await resolveAuthorId();
  const categories = await prisma.blogCategory.findMany({
    select: { id: true, slug: true },
  });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  const tags = await prisma.blogTag.findMany({ select: { id: true, slug: true, name: true } });
  const tagByName = new Map(tags.map((t) => [t.name, t.id]));

  console.log(`\nArtículos borrador (${PHASE7_ARTICLE_COUNT} definidos):`);

  let created = 0;
  let updated = 0;

  for (const draft of PHASE7_ALL_ARTICLES) {
    const categoryId = categoryBySlug.get(draft.categorySlug);
    if (!categoryId) {
      throw new Error(`Categoría no encontrada: ${draft.categorySlug} (${draft.title})`);
    }

    const prepared = await prepareDraftForSeed(draft);
    const tagIds = draft.tags
      .map((name) => tagByName.get(name))
      .filter((id): id is number => id != null);

    const existing = await prisma.blogPost.findUnique({
      where: { slug: draft.slug },
      select: { id: true },
    });

    const post = await prisma.blogPost.upsert({
      where: { slug: draft.slug },
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
        isFeatured: prepared.isFeatured ?? false,
        categoryId,
        authorId,
        heroImageUrl: null,
        ogImageUrl: null,
      },
      create: {
        title: prepared.title,
        slug: prepared.slug,
        excerpt: prepared.excerpt,
        contentJson: prepared.contentJson,
        contentHtml: prepared.contentHtml,
        readingTimeMin: prepared.readingTimeMin,
        status: BlogPostStatus.DRAFT,
        type: prepared.type,
        seoTitle: prepared.seoTitle,
        seoDescription: prepared.seoDescription,
        seoGoal: prepared.seoGoal,
        isFeatured: prepared.isFeatured ?? false,
        categoryId,
        authorId,
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

    if (prepared.isFeatured) {
      await ensureSingleFeaturedBlogPost(prisma, post.id, true);
    }

    if (existing) updated++;
    else created++;

    const flag = prepared.isFeatured ? " ★" : "";
    console.log(`  ✓ [${draft.categorySlug}] ${draft.title}${flag}`);
  }

  console.log(`\nResumen: ${created} creados, ${updated} actualizados.`);
}

async function main() {
  console.log("🌱 Seed blog — Fase 7 contenidos estratégicos\n");
  await seedCategories();
  await seedTags();
  await seedArticles();
  console.log("\n✅ Fase 7 completada. Todos los artículos quedaron en DRAFT.");
  console.log("   Prompts de imagen (hero/thumbnail/og) en cada post → campo seoGoal → imagePlan.");
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
