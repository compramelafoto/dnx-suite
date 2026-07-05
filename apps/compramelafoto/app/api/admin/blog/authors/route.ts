import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleBlogPrismaError,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import {
  formatBlogValidationError,
  parseBlogAuthorCreate,
} from "@/lib/blog/validate-blog-author";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "1";

  const authors = await prisma.blogAuthor.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { posts: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ authors });
}

export async function POST(req: NextRequest) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBlogAuthorCreate(body);
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
    const author = await prisma.blogAuthor.create({ data: parsed.data });
    return NextResponse.json({ author }, { status: 201 });
  } catch (err) {
    return handleBlogPrismaError(err, "el autor");
  }
}
