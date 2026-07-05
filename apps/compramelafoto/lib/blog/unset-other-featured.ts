import type { PrismaClient } from "@prisma/client";

type PrismaLike = Pick<PrismaClient, "blogPost">;

/**
 * Garantiza un solo artículo destacado activo.
 * Desmarca `isFeatured` en todos los demás posts publicados.
 */
export async function unsetOtherFeaturedBlogPosts(
  prisma: PrismaLike,
  featuredPostId: number
): Promise<number> {
  const result = await prisma.blogPost.updateMany({
    where: {
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
