import { CLF_CONTENT_PLATFORM } from "@/lib/blog/content-platform";
import { prisma } from "@/lib/prisma";
import { getAdminPostById } from "@repo/content";

export async function getAdminBlogPostForEdit(id: number) {
  return getAdminPostById({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    id,
  });
}
