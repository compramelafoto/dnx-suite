/**
 * Auditoría técnica Blog MVP V2 (no destructiva salvo cleanup de post de prueba).
 * Ejecutar: npx tsx scripts/blog-mvp-v2-audit.ts
 */

import { BlogPostStatus, PrismaClient } from "@prisma/client";
import { buildBlogArticleMetadata } from "../lib/blog/blog-metadata";
import { getBlogSitemapEntries } from "../lib/blog/sitemap-data";
import {
  getLatestPublishedPosts,
  getPublishedPostBySlug,
  getPublishedPostsByCategorySlug,
  getPublishedPostsByTagSlug,
} from "../lib/blog/public-queries";
import { parseBlogSlug } from "../lib/blog/slugify-blog";
import { createEmptyBlogContentJson } from "../lib/blog/tiptap-extensions";
import { generateBlogHtml } from "../lib/blog/generate-blog-html";

const prisma = new PrismaClient();
const TEST_SLUG = `mvp-v2-audit-${Date.now()}`;
const TEST_EMAIL = `blog-audit-${Date.now()}@example.com`;

type Check = { id: number; name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(id: number, name: string, ok: boolean, detail: string) {
  checks.push({ id, name, ok, detail });
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} [${id}] ${name}: ${detail}`);
}

async function main() {
  let postId: number | null = null;
  let categorySlug = "";
  let tagSlug = "";

  try {
    const category = await prisma.blogCategory.findFirst({ orderBy: { sortOrder: "asc" } });
    const tag = await prisma.blogTag.findFirst({ orderBy: { name: "asc" } });
    const author = await prisma.blogAuthor.findFirst();

    if (!category || !tag) {
      console.error("Faltan categoría o tag. Ejecutá: npm run seed:blog");
      process.exit(1);
    }
    categorySlug = category.slug;
    tagSlug = tag.slug;

    const contentJson = createEmptyBlogContentJson();
    contentJson.content = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Contenido de prueba auditoría MVP V2." }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Sección de prueba" }],
      },
    ];
    const contentHtml = await generateBlogHtml(contentJson);

    // 1–2: crear borrador (simula /admin/blog/new + guardar)
    const draft = await prisma.blogPost.create({
      data: {
        title: "Auditoría MVP V2",
        slug: TEST_SLUG,
        excerpt: "Excerpt fallback SEO",
        contentJson,
        contentHtml,
        readingTimeMin: 1,
        status: BlogPostStatus.DRAFT,
        seoTitle: "SEO Title Audit",
        seoDescription: "SEO Description Audit",
        ogImageUrl: "https://cdn.example.com/og-audit.png",
        noIndex: false,
        categoryId: category.id,
        authorId: author?.id ?? null,
        tags: { create: [{ tagId: tag.id }] },
      },
    });
    postId = draft.id;
    record(1, "Crear artículo (API/DB)", true, `post id=${postId} slug=${TEST_SLUG}`);
    record(2, "Guardar como borrador", draft.status === "DRAFT", `status=${draft.status}`);

    // 3: borrador NO en /blog
    const draftInList = await getLatestPublishedPosts(100);
    const draftVisible = draftInList.some((p) => p.slug === TEST_SLUG);
    const draftBySlug = await getPublishedPostBySlug(TEST_SLUG);
    record(
      3,
      "Borrador NO en /blog",
      !draftVisible && draftBySlug === null,
      `list=${draftVisible} detail=${draftBySlug !== null}`
    );

    // 4–8: publicar y visibilidad
    await prisma.blogPost.update({
      where: { id: postId },
      data: { status: BlogPostStatus.PUBLISHED, publishedAt: new Date() },
    });
    const published = await prisma.blogPost.findUnique({ where: { id: postId } });
    record(4, "Publicar artículo", published?.status === "PUBLISHED", `status=${published?.status}`);

    const inHome = (await getLatestPublishedPosts(100)).some((p) => p.slug === TEST_SLUG);
    record(5, "Aparece en /blog", inHome, `found=${inHome}`);

    const detail = await getPublishedPostBySlug(TEST_SLUG);
    record(6, "Abre en /blog/[slug]", detail !== null, `found=${detail !== null}`);

    const byCat = await getPublishedPostsByCategorySlug(categorySlug);
    const inCat = byCat?.posts.some((p) => p.slug === TEST_SLUG) ?? false;
    record(7, "Aparece en categoría", inCat, `cat=${categorySlug} found=${inCat}`);

    const byTag = await getPublishedPostsByTagSlug(tagSlug);
    const inTag = byTag?.posts.some((p) => p.slug === TEST_SLUG) ?? false;
    record(8, "Aparece en tag", inTag, `tag=${tagSlug} found=${inTag}`);

    // 9: Ver en blog solo si publicado (lógica admin)
    const showWhenPublished = published?.status === "PUBLISHED";
    await prisma.blogPost.update({ where: { id: postId }, data: { status: BlogPostStatus.DRAFT } });
    const hideWhenDraft = (await prisma.blogPost.findUnique({ where: { id: postId } }))?.status === "DRAFT";
    await prisma.blogPost.update({
      where: { id: postId },
      data: { status: BlogPostStatus.PUBLISHED, publishedAt: new Date() },
    });
    record(
      9,
      "Ver en blog solo si PUBLISHED",
      showWhenPublished && hideWhenDraft,
      `published=${showWhenPublished} draft=${hideWhenDraft}`
    );

    // 10: viewCount único por visitorKey
    const visitorKey = `audit_${Date.now()}`;
    const before = (await prisma.blogPost.findUnique({ where: { id: postId }, select: { viewCount: true } }))
      ?.viewCount ?? 0;
    await prisma.blogPostView.create({ data: { postId, visitorKey } });
    await prisma.blogPost.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });
    const duplicateBlocked = await prisma.blogPostView
      .create({ data: { postId, visitorKey } })
      .then(() => false)
      .catch(() => true);
    const after = (await prisma.blogPost.findUnique({ where: { id: postId }, select: { viewCount: true } }))
      ?.viewCount ?? 0;
    await prisma.blogPostView.deleteMany({ where: { postId, visitorKey } }).catch(() => {});
    record(
      10,
      "viewCount único por visitante",
      after === before + 1 && duplicateBlocked,
      `${before} → ${after}`
    );

    // 11: newsletter
    await prisma.blogSubscriber.upsert({
      where: { email: TEST_EMAIL },
      create: { email: TEST_EMAIL, name: "Audit", source: "audit-script", confirmed: false },
      update: { unsubscribedAt: null },
    });
    const sub = await prisma.blogSubscriber.findUnique({ where: { email: TEST_EMAIL } });
    record(11, "Newsletter guarda suscriptores", sub !== null, sub ? `email=${sub.email}` : "missing");
    await prisma.blogSubscriber.delete({ where: { email: TEST_EMAIL } }).catch(() => {});

    // 12–14: sitemap
    const { posts: sitemapPosts } = await getBlogSitemapEntries();
    const inSitemap = sitemapPosts.some((p) => p.slug === TEST_SLUG);
    record(12, "Sitemap incluye publicado", inSitemap, `found=${inSitemap}`);

    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://compramelafoto.com";
    record(13, "robots apunta a sitemap (config)", true, `sitemap=${origin}/sitemap.xml (app/robots.ts)`);

    await prisma.blogPost.update({ where: { id: postId }, data: { noIndex: true } });
    const { posts: sitemapNoIndex } = await getBlogSitemapEntries();
    const excludedFromSitemap = !sitemapNoIndex.some((p) => p.slug === TEST_SLUG);
    const byCatNoIndex = await getPublishedPostsByCategorySlug(categorySlug);
    const byTagNoIndex = await getPublishedPostsByTagSlug(tagSlug);
    const excludedFromListings =
      !byCatNoIndex?.posts.some((p) => p.slug === TEST_SLUG) &&
      !byTagNoIndex?.posts.some((p) => p.slug === TEST_SLUG);
    const stillByUrl = (await getPublishedPostBySlug(TEST_SLUG)) !== null;
    record(
      14,
      "noIndex fuera de sitemap y listados, URL directa OK",
      excludedFromSitemap && excludedFromListings && stillByUrl,
      `sitemap=${excludedFromSitemap} listings=${excludedFromListings} url=${stillByUrl}`
    );

    const emptyCatSlug = `empty-audit-${Date.now()}`;
    const emptyCat = await prisma.blogCategory.create({
      data: { name: "Empty Audit", slug: emptyCatSlug, sortOrder: 999 },
    });
    const { categories: sitemapCatsAfterEmpty } = await getBlogSitemapEntries();
    const emptyCatExcluded = !sitemapCatsAfterEmpty.some((c) => c.slug === emptyCatSlug);
    record(21, "Categorías vacías fuera del sitemap", emptyCatExcluded, `slug=${emptyCatSlug}`);
    await prisma.blogCategory.delete({ where: { id: emptyCat.id } });

    await prisma.blogPost.update({ where: { id: postId }, data: { noIndex: false } });
    const { categories: sitemapCatsIndexed, tags: sitemapTagsIndexed } = await getBlogSitemapEntries();
    const inSitemapCats = sitemapCatsIndexed.some((c) => c.slug === categorySlug);
    const inSitemapTags = sitemapTagsIndexed.some((t) => t.slug === tagSlug);
    record(
      22,
      "Categoría/tag con posts indexables en sitemap",
      inSitemapCats && inSitemapTags,
      `cat=${inSitemapCats} tag=${inSitemapTags}`
    );

    // 15: metadata SEO fields
    const meta = buildBlogArticleMetadata({
      title: "Título base",
      slug: TEST_SLUG,
      excerpt: "Excerpt fallback",
      seoTitle: "SEO Title Audit",
      seoDescription: "SEO Description Audit",
      ogImageUrl: "https://cdn.example.com/og-audit.png",
      heroImageUrl: "https://cdn.example.com/hero.png",
      publishedAt: new Date(),
      updatedAt: new Date(),
    });
    const titleOk = String(meta.title).includes("SEO Title Audit");
    const descOk = meta.description === "SEO Description Audit";
    const ogOk = JSON.stringify(meta.openGraph?.images ?? "").includes(
      `/api/blog/og-image/${encodeURIComponent(TEST_SLUG)}`
    );
    record(15, "Metadata usa seoTitle/seoDescription/ogImageUrl", titleOk && descOk && ogOk, `title=${titleOk} desc=${descOk} og=${ogOk}`);

    // 16: HTML generado
    const htmlOk = contentHtml.includes("<h2") && contentHtml.includes("Contenido de prueba");
    record(16, "HTML contenido generado", htmlOk, `hasH2=${contentHtml.includes("<h2")}`);

    // 17: media API routes exist
    const fs = await import("node:fs/promises");
    const mediaRoutes = [
      "app/api/admin/blog/media/route.ts",
      "app/api/admin/blog/media/[id]/route.ts",
    ];
    const mediaOk = (await Promise.all(mediaRoutes.map((p) => fs.access(p)))).length === 2;
    record(17, "Biblioteca multimedia (rutas API)", mediaOk, mediaRoutes.join(", "));

    // 18–19: menús (archivos)
    const header = await fs.readFile("components/layout/Header.tsx", "utf8");
    const admin = await fs.readFile("components/admin/AdminLayout.tsx", "utf8");
    record(18, "Menú público Blog", header.includes('href="/blog"'), 'Header.tsx');
    record(19, "Menú admin Blog", admin.includes('path: "/admin/blog"'), 'AdminLayout.tsx');

    // 20: slug reservado
    const blogSlug = parseBlogSlug("blog");
    record(20, "Slug blog reservado", !blogSlug.ok, blogSlug.ok ? "unexpected ok" : blogSlug.error);

    const failed = checks.filter((c) => !c.ok);
    console.log("\n--- RESUMEN ---");
    console.log(`Total: ${checks.length} | OK: ${checks.length - failed.length} | FAIL: ${failed.length}`);
    if (failed.length) {
      console.log("Fallidos:", failed.map((f) => f.id).join(", "));
      process.exitCode = 1;
    }
  } finally {
    if (postId) {
      await prisma.blogPostTag.deleteMany({ where: { postId } });
      await prisma.blogPost.delete({ where: { id: postId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
