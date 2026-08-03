/**
 * Validación Fase 7 antes de commit.
 * npx tsx scripts/validate-blog-phase7.ts
 */

import { BlogPostStatus, PrismaClient } from "@prisma/client";
import { PHASE7_ALL_ARTICLES, PHASE7_ARTICLE_COUNT } from "@/data/blog/phase7";
import { CLF_CONTENT_PLATFORM } from "@/lib/blog/content-platform";
import { parseBlogSeoGoal } from "@/lib/blog/blog-seo-goal";
import {
  getLatestPublishedPosts,
  getPublishedPostBySlug,
} from "@/lib/blog/public-queries";

const prisma = new PrismaClient();
const PHASE7_SLUGS = new Set(PHASE7_ALL_ARTICLES.map((a) => a.slug));

type Check = { id: number; name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(id: number, name: string, ok: boolean, detail: string) {
  checks.push({ id, name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} [${id}] ${name}: ${detail}`);
}

async function main() {
  const posts = await prisma.blogPost.findMany({
    where: { platform: CLF_CONTENT_PLATFORM, slug: { in: [...PHASE7_SLUGS] } },
    select: {
      slug: true,
      status: true,
      isFeatured: true,
      heroImageUrl: true,
      ogImageUrl: true,
      seoGoal: true,
      category: { select: { slug: true, name: true } },
    },
  });

  record(
    1,
    "52 artículos Fase 7 en DB",
    posts.length === PHASE7_ARTICLE_COUNT,
    `found=${posts.length} expected=${PHASE7_ARTICLE_COUNT}`
  );

  const allDraft = posts.every((p) => p.status === BlogPostStatus.DRAFT);
  const nonDraft = posts.filter((p) => p.status !== BlogPostStatus.DRAFT);
  record(
    1,
    "Todos en DRAFT",
    allDraft,
    nonDraft.length ? `no draft: ${nonDraft.map((p) => p.slug).join(", ")}` : "52/52 DRAFT"
  );

  const publicList = await getLatestPublishedPosts(200);
  const publicSlugs = publicList.filter((p) => PHASE7_SLUGS.has(p.slug));
  const publicBySlug = await Promise.all(
    [...PHASE7_SLUGS].slice(0, 5).map(async (slug) => ({
      slug,
      found: (await getPublishedPostBySlug(slug)) !== null,
    }))
  );
  const anyPublicDetail = await Promise.all(
    [...PHASE7_SLUGS].map(async (slug) => ({
      slug,
      found: (await getPublishedPostBySlug(slug)) !== null,
    }))
  );
  const anyPublic = anyPublicDetail.some((r) => r.found) || publicSlugs.length > 0;
  record(
    2,
    "Ninguno visible en /blog",
    !anyPublic,
    anyPublic
      ? `visible: ${[...publicSlugs.map((p) => p.slug), ...anyPublicDetail.filter((r) => r.found).map((r) => r.slug)].join(", ")}`
      : "0 en listado público ni por slug"
  );

  const newCats = ["guias", "funcionalidades", "comparativas", "casos-de-uso"];
  const cats = await prisma.blogCategory.findMany({
    where: { platform: CLF_CONTENT_PLATFORM, slug: { in: newCats } },
    select: { slug: true, name: true },
  });
  record(
    3,
    "Categorías nuevas en DB",
    cats.length === newCats.length,
    cats.map((c) => `${c.name}(${c.slug})`).join(", ")
  );

  const fs = await import("node:fs/promises");
  const publicSlugsFile = await fs.readFile("lib/public-slugs.ts", "utf8");
  const hasTutorialesReserved = publicSlugsFile.includes('"tutoriales"');
  const guiasCat = cats.find((c) => c.slug === "guias");
  record(
    4,
    "guias no choca con /tutoriales",
    hasTutorialesReserved && guiasCat?.slug === "guias",
    `categoría=/blog/categoria/guias, ruta estática=/tutoriales (reservado)`
  );

  const featured = posts.find((p) => p.slug === "como-generar-ingresos-recomendando-compramelafoto");
  record(
    5,
    "Destacado referidos en DRAFT + isFeatured",
    featured?.status === BlogPostStatus.DRAFT && featured?.isFeatured === true,
    `status=${featured?.status} isFeatured=${featured?.isFeatured}`
  );

  const invalidSeo = posts.filter((p) => !parseBlogSeoGoal(p.seoGoal));
  record(
    6,
    "seoGoal JSON válido (imagePlan)",
    invalidSeo.length === 0,
    invalidSeo.length ? `inválidos: ${invalidSeo.map((p) => p.slug).join(", ")}` : "52/52"
  );

  const withImages = posts.filter((p) => p.heroImageUrl || p.ogImageUrl);
  record(
    7,
    "heroImageUrl y ogImageUrl null",
    withImages.length === 0,
    withImages.length ? withImages.map((p) => p.slug).join(", ") : "52/52 null"
  );

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n--- RESUMEN: ${checks.length - failed.length}/${checks.length} OK ---`);
  if (failed.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
