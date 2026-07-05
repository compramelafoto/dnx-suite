import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleBlogPrismaError,
  parseRouteId,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import { mapPostResponse, postInclude } from "@/lib/blog/post-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } | Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const postId = parseRouteId(id);
  if (!postId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const post = await prisma.blogPost.findUnique({
      where: { id: postId },
      include: postInclude,
    });
    if (!post) return NextResponse.json({ error: "Artículo no encontrado" }, { status: 404 });

    return NextResponse.json({ post: mapPostResponse(post) });
  } catch (err) {
    console.error("Blog admin GET post:", err);
    return NextResponse.json({ error: "No se pudo cargar el artículo" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const postId = parseRouteId(id);
  if (!postId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { parseBlogPostUpdate, formatBlogValidationError } = await import(
    "@/lib/blog/validate-blog-post"
  );
  const { updateBlogPostRecord, mapRelationError } = await import("@/lib/blog/post-persistence");

  const parsed = parseBlogPostUpdate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatBlogValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const post = await updateBlogPostRecord(prisma, postId, parsed.data);
    if (!post) return NextResponse.json({ error: "Artículo no encontrado" }, { status: 404 });
    return NextResponse.json({ post: mapPostResponse(post) });
  } catch (err) {
    const relationError = mapRelationError(err);
    if (relationError) {
      return NextResponse.json({ error: relationError }, { status: 400 });
    }
    console.error("Blog admin PATCH post:", err);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("generateHTML") || message.includes("TipTap") || message.includes("sanitize")) {
      return NextResponse.json(
        { error: "No se pudo generar el HTML del contenido. Revisá el cuerpo del artículo." },
        { status: 500 }
      );
    }
    return handleBlogPrismaError(err, "el artículo");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const postId = parseRouteId(id);
  if (!postId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    await prisma.blogPost.delete({ where: { id: postId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleBlogPrismaError(err, "el artículo");
  }
}
