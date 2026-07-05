import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleBlogPrismaError,
  parseRouteId,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import {
  formatBlogValidationError,
  parseBlogAuthorUpdate,
} from "@/lib/blog/validate-blog-author";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } | Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const authorId = parseRouteId(id);
  if (!authorId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const author = await prisma.blogAuthor.findUnique({
    where: { id: authorId },
    include: {
      _count: { select: { posts: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!author) return NextResponse.json({ error: "Autor no encontrado" }, { status: 404 });

  return NextResponse.json({ author });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const authorId = parseRouteId(id);
  if (!authorId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = parseBlogAuthorUpdate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatBlogValidationError(parsed.error) },
      { status: 400 }
    );
  }

  if (parsed.data.userId != null) {
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "El usuario vinculado no existe" }, { status: 400 });
    }
  }

  try {
    const author = await prisma.blogAuthor.update({
      where: { id: authorId },
      data: parsed.data,
    });
    return NextResponse.json({ author });
  } catch (err) {
    return handleBlogPrismaError(err, "el autor");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const authorId = parseRouteId(id);
  if (!authorId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    await prisma.blogAuthor.delete({ where: { id: authorId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleBlogPrismaError(err, "el autor");
  }
}
