import type { JSONContent } from "@tiptap/core";
import type { BlogPostFormValues } from "@/lib/blog/blog-post-form-types";
import type { AdminBlogPostDetail } from "@/lib/blog/post-queries";
import { createEmptyBlogContentJson } from "@/lib/blog/tiptap-content-utils";

function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function mapAdminBlogPostToFormValues(
  post: AdminBlogPostDetail
): Partial<BlogPostFormValues> {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || "",
    contentJson: (post.contentJson as JSONContent) || createEmptyBlogContentJson(),
    heroImageUrl: post.heroImageUrl || "",
    status: post.status,
    type: post.type,
    categoryId: post.categoryId ? String(post.categoryId) : "",
    authorId: post.authorId ? String(post.authorId) : "",
    tagIds: (post.tags || []).map((tag) => tag.id),
    seoTitle: post.seoTitle || "",
    seoDescription: post.seoDescription || "",
    seoGoal: post.seoGoal || "",
    ogImageUrl: post.ogImageUrl || "",
    canonicalUrl: post.canonicalUrl || "",
    noIndex: post.noIndex,
    lastReviewedAt: toDateInputValue(post.lastReviewedAt),
    isFeatured: post.isFeatured,
    featuredUntil: toDateInputValue(post.featuredUntil),
  };
}
