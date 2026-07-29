import { notFound } from "next/navigation";
import Link from "next/link";
import { buildBlogCategoryMetadata } from "@/lib/blog/blog-metadata";
import BlogCategoryChips from "@/components/blog/BlogCategoryChips";
import BlogPageShell from "@/components/blog/BlogPageShell";
import BlogPostCard from "@/components/blog/BlogPostCard";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import {
  getBlogCategoriesForHome,
  getPublishedPostsByCategorySlug,
} from "@/lib/blog/public-queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await Promise.resolve(params);
  const result = await getPublishedPostsByCategorySlug(slug, 1);
  if (!result) return { title: "Categoría no encontrada | ComprameLaFoto" };
  return buildBlogCategoryMetadata(result.category);
}

export default async function BlogCategoryPage({ params }: PageProps) {
  const { slug } = await Promise.resolve(params);
  const [result, allCategories] = await Promise.all([
    getPublishedPostsByCategorySlug(slug),
    getBlogCategoriesForHome(),
  ]);
  if (!result) notFound();

  const { category, posts } = result;
  const categoryChips = allCategories
    .filter((c) => c._count.posts > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      postCount: c._count.posts,
    }));

  return (
    <BlogPageShell innerClassName="ds-stack-section">
      <header className="ds-content-container">
        <Link href="/blog" className="blog-back-link">
          ← Volver al blog
        </Link>
        <h1 className="blog-page-title mt-4">{category.name}</h1>
        {category.description ? (
          <p className="blog-page-lead">{category.description}</p>
        ) : null}
      </header>

      {categoryChips.length > 0 ? (
        <BlogCategoryChips categories={categoryChips} activeSlug={category.slug} />
      ) : null}

      {posts.length === 0 ? (
        <div className="blog-empty-panel">
          <DsEmptyState variant="tight">
            No hay artículos publicados en esta categoría.
          </DsEmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </BlogPageShell>
  );
}
