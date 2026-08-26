import type { PrismaClient } from "@prisma/client";
import {
  ContentError,
  createContentPost,
  deleteContentPost,
  mapPostResponse,
  postInclude,
  updateContentPost,
  type BlogPostCreateInput,
  type BlogPostUpdateInput,
} from "@repo/content";
import { CLF_CONTENT_PLATFORM } from "@/lib/blog/content-platform";
import { syncBlogPostImageFields } from "@/lib/blog/blog-post-images";

export { mapPostResponse, postInclude };

export async function createBlogPostRecord(prisma: PrismaClient, input: BlogPostCreateInput) {
  const images = syncBlogPostImageFields(input);
  return createContentPost({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    data: {
      ...input,
      heroImageUrl: images.heroImageUrl,
      ogImageUrl: images.ogImageUrl,
    },
  });
}

export async function updateBlogPostRecord(
  prisma: PrismaClient,
  postId: number,
  input: BlogPostUpdateInput
) {
  return updateContentPost({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    postId,
    data: input,
  });
}

export async function deleteBlogPostRecord(prisma: PrismaClient, postId: number): Promise<boolean> {
  return deleteContentPost({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    postId,
  });
}

export function mapRelationError(error: unknown): string | null {
  if (error instanceof ContentError) {
    if (error.code === "CONTENT_CATEGORY_NOT_FOUND") return "La categoría indicada no existe";
    if (error.code === "CONTENT_AUTHOR_NOT_FOUND") return "El autor indicado no existe";
    if (error.code === "CONTENT_TAG_NOT_FOUND") return "Uno o más tags no existen";
  }
  const message = error instanceof Error ? error.message : "";
  if (message === "CATEGORY_NOT_FOUND") return "La categoría indicada no existe";
  if (message === "AUTHOR_NOT_FOUND") return "El autor indicado no existe";
  if (message === "TAG_NOT_FOUND") return "Uno o más tags no existen";
  return null;
}
