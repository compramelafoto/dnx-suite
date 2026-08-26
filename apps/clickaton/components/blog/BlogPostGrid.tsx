import type { PublicContentPostListItem } from "@/lib/content/public-queries";
import { BlogPostCard } from "@/components/blog/BlogPostCard";

type Props = {
  posts: PublicContentPostListItem[];
  emptyMessage?: string;
};

export function BlogPostGrid({
  posts,
  emptyMessage = "Todavía no hay notas publicadas en esta sección.",
}: Props) {
  if (posts.length === 0) {
    return (
      <p className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-6 py-12 text-center text-sm text-ck-text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <li key={post.id} className="flex">
          <BlogPostCard post={post} />
        </li>
      ))}
    </ul>
  );
}
