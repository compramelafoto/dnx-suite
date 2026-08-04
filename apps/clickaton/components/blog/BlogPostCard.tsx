import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { PublicContentPostListItem } from "@/lib/content/public-queries";
import { blogPostPath } from "@/lib/content/content-site-config";
import { formatBlogDate } from "@/components/blog/blog-format";

type Props = {
  post: PublicContentPostListItem;
  featured?: boolean;
};

export function BlogPostCard({ post, featured = false }: Props) {
  const href = blogPostPath(post.slug);
  const cover = post.heroImageUrl?.trim() || null;

  return (
    <Card
      variant="outlined"
      className="flex h-full flex-col overflow-hidden p-0 transition-colors hover:border-ck-yellow"
    >
      <Link href={href} className="block focus-visible:outline-none">
        <div
          className={
            featured
              ? "relative aspect-[16/9] w-full overflow-hidden bg-ck-surface-strong"
              : "relative aspect-[3/2] w-full overflow-hidden bg-ck-surface-strong"
          }
        >
          {cover ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={cover}
              alt={post.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading={featured ? "eager" : "lazy"}
            />
          ) : (
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(135deg,rgb(255_196_0_/_0.18)_0%,rgb(17_17_17_/_0.9)_70%)]"
            />
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.12em] text-ck-text-muted">
          {post.category ? (
            <span className="text-ck-yellow">{post.category.name}</span>
          ) : null}
          <span>{formatBlogDate(post.publishedAt)}</span>
          {post.readingTimeMin ? <span>{post.readingTimeMin} min</span> : null}
        </div>

        <h3 className={featured ? "text-2xl text-ck-text sm:text-3xl" : "text-xl text-ck-text"}>
          <Link href={href} className="hover:text-ck-yellow">
            {post.title}
          </Link>
        </h3>

        {post.excerpt ? (
          <p className="text-sm leading-relaxed text-ck-text-secondary">{post.excerpt}</p>
        ) : null}

        <div className="mt-auto pt-2 text-sm">
          <Link href={href} className="font-medium text-ck-yellow hover:underline">
            Leer la nota
          </Link>
        </div>
      </div>
    </Card>
  );
}
