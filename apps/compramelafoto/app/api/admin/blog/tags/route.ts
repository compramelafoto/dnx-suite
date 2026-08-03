import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleBlogPrismaError,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import { CLF_CONTENT_PLATFORM, clfPlatformWhere } from "@/lib/blog/content-platform";
import { formatBlogValidationError, parseBlogTagCreate } from "@/lib/blog/validate-blog-tag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const tags = await prisma.blogTag.findMany({
    where: clfPlatformWhere,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { posts: true } },
    },
  });

  return NextResponse.json({ tags });
}

export async function POST(req: NextRequest) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = parseBlogTagCreate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatBlogValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const tag = await prisma.blogTag.create({
      data: {
        ...parsed.data,
        platform: CLF_CONTENT_PLATFORM,
      },
    });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (err) {
    return handleBlogPrismaError(err, "el tag");
  }
}
