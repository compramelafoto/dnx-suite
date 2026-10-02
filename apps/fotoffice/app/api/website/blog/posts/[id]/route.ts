import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentPostUpdate } from "@repo/content";
import { parseRouteId, requireBlogEditorApi } from "@/lib/blog/access";
import { handleBlogApiError, idInvalido, validacionFallida } from "@/lib/blog/admin-errors";
import {
  deleteBlogPost,
  getBlogAdminPost,
  mapContentPostResponse,
  updateBlogPost,
} from "@/lib/blog/admin-queries";
import { stripClientScope } from "@/lib/blog/admin-utils";
import { BLOG_RESERVED_POST_SLUGS } from "@/lib/blog/public-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

const noEncontrado = () => NextResponse.json({ error: "Artículo no encontrado" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const postId = parseRouteId((await params).id);
  if (!postId) return idInvalido();

  try {
    const post = await getBlogAdminPost(ctx.workspace.id, postId);
    return post ? NextResponse.json({ post }) : noEncontrado();
  } catch (err) {
    return handleBlogApiError(err, "el artículo");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const postId = parseRouteId((await params).id);
  if (!postId) return idInvalido();

  const parsed = parseContentPostUpdate(stripClientScope(await req.json().catch(() => ({}))));
  if (!parsed.success) return validacionFallida(formatContentValidationError(parsed.error));
  // "categoria", "tag" y "rss" son direcciones del propio blog: un artículo con ese nombre
  // quedaría tapado por ellas y nadie podría abrirlo.
  if (parsed.data.slug !== undefined && BLOG_RESERVED_POST_SLUGS.has(parsed.data.slug)) {
    return validacionFallida(`La dirección "${parsed.data.slug}" está reservada por el blog. Elegí otra.`);
  }

  try {
    const post = await updateBlogPost(ctx.workspace.id, postId, parsed.data);
    return post ? NextResponse.json({ post: mapContentPostResponse(post) }) : noEncontrado();
  } catch (err) {
    return handleBlogApiError(err, "el artículo");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const postId = parseRouteId((await params).id);
  if (!postId) return idInvalido();

  try {
    const deleted = await deleteBlogPost(ctx.workspace.id, postId);
    return deleted ? NextResponse.json({ ok: true }) : noEncontrado();
  } catch (err) {
    return handleBlogApiError(err, "el artículo");
  }
}
