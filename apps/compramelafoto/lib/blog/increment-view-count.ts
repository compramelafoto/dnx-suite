import { incrementViewCount } from "@repo/content";
import { CLF_CONTENT_PLATFORM } from "@/lib/blog/content-platform";
import { prisma } from "@/lib/prisma";

/**
 * Registra una vista única del artículo (por visitorKey) e incrementa viewCount solo la primera vez.
 * Solo aplica a posts publicados de CLF. Errores se registran y no se propagan al visitante.
 */
export function incrementBlogPostUniqueViewCount(postId: number, visitorKey: string): void {
  incrementViewCount({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    postId,
    visitorKey,
  });
}
