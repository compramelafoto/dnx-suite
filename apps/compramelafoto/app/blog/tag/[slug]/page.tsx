import { notFound } from "next/navigation";
import Link from "next/link";
import { buildBlogTagMetadata } from "@/lib/blog/blog-metadata";
import BlogPageShell from "@/components/blog/BlogPageShell";
import BlogPostCard from "@/components/blog/BlogPostCard";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { getPublishedPostsByTagSlug } from "@/lib/blog/public-queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { slug: string } | Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await Promise.resolve(params);
  const result = await getPublishedPostsByTagSlug(slug, 1);
  if (!result) return { title: "Tag no encontrado | ComprameLaFoto" };
  return buildBlogTagMetadata(result.tag);
}

export default async function BlogTagPage({ params }: PageProps) {
  const { slug } = await Promise.resolve(params);
  const result = await getPublishedPostsByTagSlug(slug);
  if (!result) notFound();

  const { tag, posts } = result;

  return (
    <BlogPageShell innerClassName="ds-stack-section">
      <header className="ds-content-container">
        <Link href="/blog" className="blog-back-link">
          ← Volver al blog
        </Link>
        <p className="mt-4 text-sm font-medium uppercase tracking-wide text-[var(--ds-text-muted)]">
          Tag
        </p>
        <h1 className="blog-page-title mt-1">{tag.name}</h1>
      </header>

      {posts.length === 0 ? (
        <div className="blog-empty-panel">
          <DsEmptyState variant="tight">No hay artículos publicados con este tag.</DsEmptyState>
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
