import type { AdminBlogPostRow } from "@/lib/blog/admin-blog-types";
import { prisma } from "@/lib/prisma";

const adminPostListSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  type: true,
  isFeatured: true,
  publishedAt: true,
  viewCount: true,
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, name: true, slug: true } },
} as const;

export async function getAdminBlogPostRows(): Promise<AdminBlogPostRow[]> {
  const posts = await prisma.blogPost.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: adminPostListSelect,
  });

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    type: post.type,
    isFeatured: post.isFeatured,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    viewCount: post.viewCount,
    category: post.category,
    author: post.author,
  }));
}
