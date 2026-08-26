import type { AdminBlogPostRow } from "@/lib/blog/admin-blog-types";
import { CLF_CONTENT_PLATFORM } from "@/lib/blog/content-platform";
import { prisma } from "@/lib/prisma";
import { listAdminPosts } from "@repo/content";

export async function getAdminBlogPostRows(): Promise<AdminBlogPostRow[]> {
  return listAdminPosts({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
  });
}
