/**
 * Sincroniza ogImageUrl con heroImageUrl en artículos existentes.
 * Ejecutar: npx tsx scripts/sync-blog-og-from-hero.ts
 */

import { PrismaClient } from "@prisma/client";

import { CLF_CONTENT_PLATFORM } from "../lib/blog/content-platform";
import { syncBlogPostImageFields } from "@/lib/blog/blog-post-images";

const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.blogPost.findMany({
    where: { platform: CLF_CONTENT_PLATFORM },
    select: { id: true, slug: true, heroImageUrl: true, ogImageUrl: true },
  });

  let updated = 0;
  for (const post of posts) {
    const images = syncBlogPostImageFields(post);
    if (images.ogImageUrl === post.ogImageUrl && images.heroImageUrl === post.heroImageUrl) {
      continue;
    }
    await prisma.blogPost.updateMany({
      where: { id: post.id, platform: CLF_CONTENT_PLATFORM },
      data: { ogImageUrl: images.ogImageUrl },
    });
    updated++;
    console.log(`  ✓ ${post.slug}`);
  }

  console.log(`\nListo: ${updated} artículo(s) actualizado(s) de ${posts.length}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
