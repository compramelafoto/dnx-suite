import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentCategoryCreate } from "@repo/content";
import { prisma } from "@repo/db";
import { requireBlogEditorApi } from "@/lib/blog/access";
import { handleBlogApiError, validacionFallida } from "@/lib/blog/admin-errors";
import { listAdminBlogCategories } from "@/lib/blog/admin-queries";
import { stripClientScope } from "@/lib/blog/admin-utils";
import { blogWhere } from "@/lib/blog/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Las categorías del blog de la institución activa. Una categoría borrada deja a sus artículos sin categoría, no los borra.
 */
export async function GET() {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  try {
    return NextResponse.json({ categories: await listAdminBlogCategories(ctx.workspace.id) });
  } catch (err) {
    return handleBlogApiError(err, "las categorías");
  }
}

export async function POST(req: NextRequest) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const parsed = parseContentCategoryCreate(stripClientScope(await req.json().catch(() => ({}))));
  if (!parsed.success) return validacionFallida(formatContentValidationError(parsed.error));

  try {
    // La institución sale de la sesión y va después de lo validado: no hay forma de pisarla.
    const category = await prisma.blogCategory.create({
      data: { ...parsed.data, ...blogWhere(ctx.workspace.id) },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    return handleBlogApiError(err, "la categoría");
  }
}
