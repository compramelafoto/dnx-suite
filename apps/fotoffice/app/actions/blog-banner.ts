"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireWebsiteContext } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { getBlogAdminPost } from "@/lib/blog/admin-queries";
import { BLOG_BANNER_MAX_POSITION, blogBannerEndsAt, isBlogBannerDuration } from "@/lib/website/blog-banner";

export type BlogBannerActionState = { error: string | null; ok?: boolean };

async function contextoEditor(): Promise<{ workspaceId: string } | { error: string }> {
  const { user, workspace } = await requireWebsiteContext();
  if (!(await hasModuleLevel(user.id, workspace.id, WEBSITE_MODULE_KEY, "MANAGE"))) {
    return { error: "No tenés permiso para editar el blog." };
  }
  return { workspaceId: workspace.id };
}

/**
 * Pone el artículo en el banner principal del sitio: en la placa `position`, por `durationDays`
 * días contados desde ahora. Si ya estaba, reemplaza placa y plazo (el plazo vuelve a empezar).
 */
export async function saveBlogBannerAction(postId: number, position: number, durationDays: number): Promise<BlogBannerActionState> {
  const ctx = await contextoEditor();
  if ("error" in ctx) return { error: ctx.error };

  if (!Number.isInteger(position) || position < 1 || position > BLOG_BANNER_MAX_POSITION) {
    return { error: `Elegí una placa entre 1 y ${BLOG_BANNER_MAX_POSITION}.` };
  }
  if (!isBlogBannerDuration(durationDays)) return { error: "Elegí cuántos días va a estar en el banner." };

  // Con el filtro de la institución: un artículo ajeno no se encuentra.
  const post = await getBlogAdminPost(ctx.workspaceId, postId);
  if (!post) return { error: "No encontramos el artículo." };
  if (post.status !== "PUBLISHED") return { error: "Publicá el artículo antes de mostrarlo en el banner." };

  const startsAt = new Date();
  const endsAt = blogBannerEndsAt(startsAt, durationDays);
  await prisma.fotofficeBlogBannerSlot.upsert({
    where: { postId },
    create: { workspaceId: ctx.workspaceId, postId, position, durationDays, startsAt, endsAt },
    update: { position, durationDays, startsAt, endsAt },
  });
  revalidatePath(`/website/blog/${postId}`);
  return { error: null, ok: true };
}

export async function removeBlogBannerAction(postId: number): Promise<BlogBannerActionState> {
  const ctx = await contextoEditor();
  if ("error" in ctx) return { error: ctx.error };
  await prisma.fotofficeBlogBannerSlot.deleteMany({ where: { postId, workspaceId: ctx.workspaceId } });
  revalidatePath(`/website/blog/${postId}`);
  return { error: null, ok: true };
}
