import { NextRequest, NextResponse } from "next/server";
import {
  formatContentValidationError,
  parseContentPostCreate,
  parseContentPostStatusFilter,
  parseContentPostTypeFilter,
} from "@repo/content";
import { requireBlogEditorApi } from "@/lib/blog/access";
import { handleBlogApiError, validacionFallida } from "@/lib/blog/admin-errors";
import { createBlogPost, listBlogAdminPosts, mapContentPostResponse } from "@/lib/blog/admin-queries";
import { stripClientScope } from "@/lib/blog/admin-utils";
import { BLOG_RESERVED_POST_SLUGS } from "@/lib/blog/public-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — los artículos del blog de la institución activa, con filtros de estado, tipo y texto. */
export async function GET(req: NextRequest) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const { searchParams } = new URL(req.url);
  try {
    const posts = await listBlogAdminPosts(ctx.workspace.id, {
      status: parseContentPostStatusFilter(searchParams.get("status")),
      type: parseContentPostTypeFilter(searchParams.get("type")),
      q: searchParams.get("q"),
    });
    return NextResponse.json({ posts });
  } catch (err) {
    return handleBlogApiError(err, "los artículos");
  }
}

/** POST — crea un artículo. El autor es opcional: el primer artículo puede salir sin autores cargados. */
export async function POST(req: NextRequest) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const parsed = parseContentPostCreate(stripClientScope(await req.json().catch(() => ({}))));
  if (!parsed.success) return validacionFallida(formatContentValidationError(parsed.error));
  // "categoria", "tag" y "rss" son direcciones del propio blog: un artículo con ese nombre
  // quedaría tapado por ellas y nadie podría abrirlo.
  if (parsed.data.slug !== undefined && BLOG_RESERVED_POST_SLUGS.has(parsed.data.slug)) {
    return validacionFallida(`La dirección "${parsed.data.slug}" está reservada por el blog. Elegí otra.`);
  }

  try {
    const post = await createBlogPost(ctx.workspace.id, parsed.data);
    return NextResponse.json({ post: mapContentPostResponse(post) }, { status: 201 });
  } catch (err) {
    return handleBlogApiError(err, "el artículo");
  }
}
