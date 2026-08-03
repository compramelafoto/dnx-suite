import type { PrismaClient } from "@prisma/client";
import { clfPlatformWhere } from "@/lib/blog/content-platform";

type PrismaLike = Pick<PrismaClient, "blogPost">;

/**
 * Garantiza un solo artículo destacado activo (por plataforma CLF).
 * Desmarca `isFeatured` en todos los demás posts de la misma plataforma.
 */
export async function unsetOtherFeaturedBlogPosts(
  prisma: PrismaLike,
  featuredPostId: number
): Promise<number> {
  const result = await prisma.blogPost.updateMany({
    where: {
      ...clfPlatformWhere,
      id: { not: featuredPostId },
      isFeatured: true,
    },
    data: {
      isFeatured: false,
    },
  });
  return result.count;
}

/**
 * Al activar destacado en un post, desmarca el resto.
 * Llamar dentro de la misma transacción del guardado si es posible.
 */
export async function ensureSingleFeaturedBlogPost(
  prisma: PrismaLike,
  postId: number,
  isFeatured: boolean
): Promise<void> {
  if (!isFeatured) return;
  await unsetOtherFeaturedBlogPosts(prisma, postId);
}
