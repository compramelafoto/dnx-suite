/**
 * Seed Fase 8: contenido editorial completo para los 52 borradores del blog.
 * Ejecutar: npm run seed:blog:phase8
 *
 * Actualiza solo posts existentes por slug. Mantiene status DRAFT.
 * No genera imágenes; prompts en seoGoal (imagePlan).
 */

import { BlogPostStatus, PrismaClient } from "@prisma/client";
import { PHASE7_ALL_ARTICLES, PHASE7_ARTICLE_COUNT } from "@/data/blog/phase7";
import { listPhase8ContentSlugs } from "@/data/blog/phase8/generate";
import { preparePhase8Article } from "@/data/blog/phase8/prepare-phase8";

const prisma = new PrismaClient();

async function seedPhase8Articles() {
  const phase8Slugs = new Set(listPhase8ContentSlugs());
  const missingContent = PHASE7_ALL_ARTICLES.filter((d) => !phase8Slugs.has(d.slug));
  if (missingContent.length > 0) {
    throw new Error(
      `Faltan ${missingContent.length} slugs en Fase 8: ${missingContent.map((d) => d.slug).join(", ")}`
    );
  }

  console.log(`\nArtículos Fase 8 (${PHASE7_ARTICLE_COUNT} definidos):`);

  let updated = 0;
  let skipped = 0;

  for (const draft of PHASE7_ALL_ARTICLES) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug: draft.slug },
      select: { id: true, status: true },
    });

    if (!existing) {
      console.log(`  ⚠ No existe en DB, omitido: ${draft.slug}`);
      skipped++;
      continue;
    }

    const prepared = await preparePhase8Article(draft);

    await prisma.blogPost.update({
      where: { slug: draft.slug },
      data: {
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
      },
    });

    updated++;
    const flag = prepared.isFeatured ? " ★" : "";
    console.log(`  ✓ [${draft.categorySlug}] ${draft.title}${flag} (~${prepared.readingTimeMin} min)`);
  }

  console.log(`\nResumen: ${updated} actualizados, ${skipped} omitidos (no existían en DB).`);
}

async function main() {
  console.log("🌱 Seed blog — Fase 8 contenido editorial completo\n");
  await seedPhase8Articles();
  console.log("\n✅ Fase 8 completada. Artículos actualizados en DRAFT con contenido listo para publicar.");
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
