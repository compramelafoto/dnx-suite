/**
 * Escrituras de posts del blog Clickatón: wrappers finos sobre `@repo/content`
 * que fijan `platform = "clickaton"` en servidor.
 */
import {
  createContentPost,
  deleteContentPost,
  mapContentPostResponse,
  contentPostInclude,
  updateContentPost,
  type ContentPostCreateInput,
  type ContentPostUpdateInput,
} from "@repo/content";
import { prisma } from "@/lib/admin/db";
import { CLICKATON_CONTENT_PLATFORM } from "@/lib/content/content-platform";

export { mapContentPostResponse, contentPostInclude };

export async function createClickatonPost(input: ContentPostCreateInput) {
  return createContentPost({
    prisma,
    platform: CLICKATON_CONTENT_PLATFORM,
    data: input,
  });
}

export async function updateClickatonPost(postId: number, input: ContentPostUpdateInput) {
  return updateContentPost({
    prisma,
    platform: CLICKATON_CONTENT_PLATFORM,
    postId,
    data: input,
  });
}

export async function deleteClickatonPost(postId: number): Promise<boolean> {
  return deleteContentPost({
    prisma,
    platform: CLICKATON_CONTENT_PLATFORM,
    postId,
  });
}
