import { BlogPostStatus, Prisma, type PrismaClient } from "@prisma/client";
import { assertContentPlatform, platformWhere, type ContentPlatform } from "../platform";

/**
 * Registra una vista única (por visitorKey) e incrementa viewCount solo la primera vez.
 * Resuelve el post por id + platform primero. Errores se registran y no se propagan.
 */
export function incrementViewCount(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  postId: number;
  visitorKey: string;
}): void {
  const platform = assertContentPlatform(input.platform);
  const normalizedKey = input.visitorKey.trim().slice(0, 64);
  if (normalizedKey.length < 8) return;

  const { prisma, postId } = input;

  void (async () => {
    try {
      const published = await prisma.blogPost.findFirst({
        where: {
          id: postId,
          ...platformWhere(platform),
          status: BlogPostStatus.PUBLISHED,
        },
        select: { id: true },
      });
      if (!published) return;

      try {
        await prisma.blogPostView.create({
          data: {
            postId,
            visitorKey: normalizedKey,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return;
        }
        throw err;
      }

      await prisma.blogPost.updateMany({
        where: { id: postId, ...platformWhere(platform) },
        data: { viewCount: { increment: 1 } },
      });
    } catch (err) {
      console.error(
        `[content] unique viewCount increment failed for post ${postId} (${platform}):`,
        err
      );
    }
  })();
}
