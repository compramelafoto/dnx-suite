import type { Prisma } from "@prisma/client";

export const postInclude = {
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, name: true, slug: true, avatarUrl: true, role: true } },
  tags: {
    include: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.BlogPostInclude;

export function mapPostResponse(post: Prisma.BlogPostGetPayload<{ include: typeof postInclude }>) {
  return {
    ...post,
    tags: post.tags.map((row) => row.tag),
  };
}

export type AdminBlogPostDetail = ReturnType<typeof mapPostResponse>;
