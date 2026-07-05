import { mapPostResponse, postInclude } from "@/lib/blog/post-queries";
import { prisma } from "@/lib/prisma";

export async function getAdminBlogPostForEdit(id: number) {
  const post = await prisma.blogPost.findUnique({
    where: { id },
    include: postInclude,
  });
  if (!post) return null;
  return mapPostResponse(post);
}
