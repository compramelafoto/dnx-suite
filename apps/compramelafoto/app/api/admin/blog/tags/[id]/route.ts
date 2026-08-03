import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleBlogPrismaError,
  parseRouteId,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import { clfPlatformWhere } from "@/lib/blog/content-platform";
import { formatBlogValidationError, parseBlogTagUpdate } from "@/lib/blog/validate-blog-tag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const tagId = parseRouteId(id);
  if (!tagId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const tag = await prisma.blogTag.findFirst({
    where: { id: tagId, ...clfPlatformWhere },
    include: { _count: { select: { posts: true } } },
  });
  if (!tag) return NextResponse.json({ error: "Tag no encontrado" }, { status: 404 });

  return NextResponse.json({ tag });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const tagId = parseRouteId(id);
  if (!tagId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = parseBlogTagUpdate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatBlogValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.blogTag.updateMany({
      where: { id: tagId, ...clfPlatformWhere },
      data: parsed.data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Tag no encontrado" }, { status: 404 });
    }
    const tag = await prisma.blogTag.findFirst({
      where: { id: tagId, ...clfPlatformWhere },
    });
    return NextResponse.json({ tag });
  } catch (err) {
    return handleBlogPrismaError(err, "el tag");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const tagId = parseRouteId(id);
  if (!tagId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const deleted = await prisma.blogTag.deleteMany({
      where: { id: tagId, ...clfPlatformWhere },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Tag no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleBlogPrismaError(err, "el tag");
  }
}
