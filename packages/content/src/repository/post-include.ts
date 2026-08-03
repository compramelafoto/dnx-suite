import type { Prisma } from "@prisma/client";

export const contentPostInclude = {
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, name: true, slug: true, avatarUrl: true, role: true } },
  tags: {
    include: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.BlogPostInclude;

/** Alias CLF. */
export const postInclude = contentPostInclude;

export function mapContentPostResponse(
  post: Prisma.BlogPostGetPayload<{ include: typeof contentPostInclude }>
) {
  return {
    ...post,
    tags: post.tags.map((row) => row.tag),
  };
}

/** Alias CLF. */
export const mapPostResponse = mapContentPostResponse;

export type AdminContentPostDetail = ReturnType<typeof mapContentPostResponse>;
export type AdminBlogPostDetail = AdminContentPostDetail;
