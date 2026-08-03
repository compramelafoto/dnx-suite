import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleBlogPrismaError,
  parseRouteId,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import { clfPlatformWhere } from "@/lib/blog/content-platform";
import {
  formatBlogValidationError,
  parseBlogCategoryUpdate,
} from "@/lib/blog/validate-blog-category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const categoryId = parseRouteId(id);
  if (!categoryId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const category = await prisma.blogCategory.findFirst({
    where: { id: categoryId, ...clfPlatformWhere },
    include: { _count: { select: { posts: true } } },
  });
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

  return NextResponse.json({ category });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const categoryId = parseRouteId(id);
  if (!categoryId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = parseBlogCategoryUpdate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatBlogValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.blogCategory.updateMany({
      where: { id: categoryId, ...clfPlatformWhere },
      data: parsed.data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }
    const category = await prisma.blogCategory.findFirst({
      where: { id: categoryId, ...clfPlatformWhere },
    });
    return NextResponse.json({ category });
  } catch (err) {
    return handleBlogPrismaError(err, "la categoría");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const categoryId = parseRouteId(id);
  if (!categoryId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const deleted = await prisma.blogCategory.deleteMany({
      where: { id: categoryId, ...clfPlatformWhere },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleBlogPrismaError(err, "la categoría");
  }
}
