import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleBlogPrismaError,
  parseRouteId,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
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

  const category = await prisma.blogCategory.findUnique({
    where: { id: categoryId },
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
    const category = await prisma.blogCategory.update({
      where: { id: categoryId },
      data: parsed.data,
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
    await prisma.blogCategory.delete({ where: { id: categoryId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleBlogPrismaError(err, "la categoría");
  }
}
