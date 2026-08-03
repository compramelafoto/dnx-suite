import { BlogPostStatus, Prisma } from "@prisma/client";
import { clfPlatformWhere } from "@/lib/blog/content-platform";
import { prisma } from "@/lib/prisma";

/**
 * Registra una vista única del artículo (por visitorKey) e incrementa viewCount solo la primera vez.
 * Solo aplica a posts publicados de CLF. Errores se registran y no se propagan al visitante.
 */
export function incrementBlogPostUniqueViewCount(postId: number, visitorKey: string): void {
  const normalizedKey = visitorKey.trim().slice(0, 64);
  if (normalizedKey.length < 8) return;

  void (async () => {
    try {
      const published = await prisma.blogPost.findFirst({
        where: {
          id: postId,
          ...clfPlatformWhere,
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
        where: { id: postId, ...clfPlatformWhere },
        data: { viewCount: { increment: 1 } },
      });
    } catch (err) {
      console.error(`[blog] unique viewCount increment failed for post ${postId}:`, err);
    }
  })();
}
