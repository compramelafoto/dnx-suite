import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleBlogPrismaError,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import {
  formatBlogValidationError,
  parseBlogCategoryCreate,
} from "@/lib/blog/validate-blog-category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const categories = await prisma.blogCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { posts: true } },
    },
  });

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBlogCategoryCreate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatBlogValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const category = await prisma.blogCategory.create({
      data: parsed.data,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    return handleBlogPrismaError(err, "la categoría");
  }
}
