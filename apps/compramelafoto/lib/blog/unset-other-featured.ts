import type { PrismaClient } from "@prisma/client";
import {
  ensureSingleFeaturedPost,
  unsetOtherFeaturedPosts,
} from "@repo/content";
import { CLF_CONTENT_PLATFORM } from "@/lib/blog/content-platform";

type PrismaLike = Pick<PrismaClient, "blogPost">;

/**
 * Garantiza un solo artículo destacado activo (por plataforma CLF).
 * Desmarca `isFeatured` en todos los demás posts de la misma plataforma.
 */
export async function unsetOtherFeaturedBlogPosts(
  prisma: PrismaLike,
  featuredPostId: number
): Promise<number> {
  return unsetOtherFeaturedPosts({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    featuredPostId,
  });
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
  return ensureSingleFeaturedPost({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    postId,
    isFeatured,
  });
}
