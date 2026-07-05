import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseBlogPostStatusFilter,
  parseBlogPostTypeFilter,
} from "@/lib/blog/blog-enums";
import {
  handleBlogPrismaError,
  parseRouteId,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import { mapPostResponse, postInclude } from "@/lib/blog/post-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = parseBlogPostStatusFilter(searchParams.get("status"));
  const type = parseBlogPostTypeFilter(searchParams.get("type"));
  const categoryId = parseRouteId(searchParams.get("categoryId"));
  const q = (searchParams.get("q") || "").trim();
  const featured = searchParams.get("featured");

  const where: Prisma.BlogPostWhereInput = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (featured === "1") where.isFeatured = true;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { excerpt: { contains: q, mode: "insensitive" } },
    ];
  }

  const posts = await prisma.blogPost.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    include: postInclude,
  });

  return NextResponse.json({
    posts: posts.map(mapPostResponse),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { parseBlogPostCreate, formatBlogValidationError } = await import(
    "@/lib/blog/validate-blog-post"
  );
  const { createBlogPostRecord, mapRelationError } = await import("@/lib/blog/post-persistence");

  const parsed = parseBlogPostCreate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatBlogValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const post = await createBlogPostRecord(prisma, parsed.data);
    return NextResponse.json({ post: mapPostResponse(post) }, { status: 201 });
  } catch (err) {
    const relationError = mapRelationError(err);
    if (relationError) {
      return NextResponse.json({ error: relationError }, { status: 400 });
    }
    return handleBlogPrismaError(err, "el artículo");
  }
}
