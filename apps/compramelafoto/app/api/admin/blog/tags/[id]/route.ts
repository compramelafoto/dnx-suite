import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleBlogPrismaError,
  parseRouteId,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import { formatBlogValidationError, parseBlogTagUpdate } from "@/lib/blog/validate-blog-tag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } | Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const tagId = parseRouteId(id);
  if (!tagId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const tag = await prisma.blogTag.findUnique({
    where: { id: tagId },
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
    const tag = await prisma.blogTag.update({
      where: { id: tagId },
      data: parsed.data,
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
    await prisma.blogTag.delete({ where: { id: tagId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleBlogPrismaError(err, "el tag");
  }
}
