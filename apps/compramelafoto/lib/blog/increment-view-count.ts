import { BlogPostStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Registra una vista única del artículo (por visitorKey) e incrementa viewCount solo la primera vez.
 * Errores se registran y no se propagan al visitante.
 */
export function incrementBlogPostUniqueViewCount(postId: number, visitorKey: string): void {
  const normalizedKey = visitorKey.trim().slice(0, 64);
  if (normalizedKey.length < 8) return;

  void (async () => {
    try {
      const published = await prisma.blogPost.findFirst({
        where: { id: postId, status: BlogPostStatus.PUBLISHED },
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

      await prisma.blogPost.update({
        where: { id: postId },
        data: { viewCount: { increment: 1 } },
      });
    } catch (err) {
      console.error(`[blog] unique viewCount increment failed for post ${postId}:`, err);
    }
  })();
}
