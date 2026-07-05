import Image from "next/image";
import Link from "next/link";
import BlogTypeBadge from "@/components/blog/BlogTypeBadge";
import { formatBlogAdminDate } from "@/components/blog/admin/blog-admin-constants";
import { resolveBlogPostThumbnailUrl } from "@/lib/blog/blog-post-images";
import type { PublicBlogPostListItem } from "@/lib/blog/public-queries";

type BlogPostCardProps = {
  post: PublicBlogPostListItem;
};

export default function BlogPostCard({ post }: BlogPostCardProps) {
  const image = resolveBlogPostThumbnailUrl(post);

  return (
    <article className="blog-card group">
      <Link href={`/blog/${post.slug}`} className="blog-card__media">
        <span className="blog-card__media-frame">
          <Image
            src={image}
            alt={post.title}
            fill
            className="blog-card__media-image"
            sizes="(max-width: 768px) 100vw, 33vw"
            unoptimized
          />
        </span>
      </Link>
      <div className="blog-card__body">
        <div className="flex flex-wrap items-center gap-2">
          <BlogTypeBadge type={post.type} />
          {post.category ? (
            <Link
              href={`/blog/categoria/${post.category.slug}`}
              className="blog-link text-xs font-medium"
            >
              {post.category.name}
            </Link>
          ) : null}
        </div>
        <h2 className="blog-card__title">
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h2>
        {post.excerpt ? (
          <p className="blog-card__excerpt line-clamp-3">{post.excerpt}</p>
        ) : null}
        <div className="blog-card__meta">
          {post.author ? <span>{post.author.name}</span> : null}
          <span>{formatBlogAdminDate(post.publishedAt)}</span>
          {post.readingTimeMin ? <span>{post.readingTimeMin} min lectura</span> : null}
        </div>
      </div>
    </article>
  );
}
