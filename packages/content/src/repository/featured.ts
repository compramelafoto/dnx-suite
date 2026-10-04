import type { PrismaClient } from "@prisma/client";
import { assertContentPlatform, platformWhere, type ContentPlatform } from "../platform";

type PrismaLike = Pick<PrismaClient, "blogPost">;

/**
 * Desmarca `isFeatured` en todos los demás posts del mismo blog (plataforma + institución).
 */
export async function unsetOtherFeaturedPosts(input: {
  prisma: PrismaLike;
  platform: ContentPlatform;
  workspaceKey?: string | null;
  featuredPostId: number;
}): Promise<number> {
  const platform = assertContentPlatform(input.platform);
  const result = await input.prisma.blogPost.updateMany({
    where: {
      ...platformWhere(platform, input.workspaceKey),
      id: { not: input.featuredPostId },
      isFeatured: true,
    },
    data: {
      isFeatured: false,
    },
  });
  return result.count;
}

export async function ensureSingleFeaturedPost(input: {
  prisma: PrismaLike;
  platform: ContentPlatform;
  workspaceKey?: string | null;
  postId: number;
  isFeatured: boolean;
}): Promise<void> {
  if (!input.isFeatured) return;
  await unsetOtherFeaturedPosts({
    prisma: input.prisma,
    platform: input.platform,
    workspaceKey: input.workspaceKey,
    featuredPostId: input.postId,
  });
}
