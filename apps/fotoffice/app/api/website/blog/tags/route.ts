import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentTagCreate } from "@repo/content";
import { prisma } from "@repo/db";
import { requireBlogEditorApi } from "@/lib/blog/access";
import { handleBlogApiError, validacionFallida } from "@/lib/blog/admin-errors";
import { listAdminBlogTags } from "@/lib/blog/admin-queries";
import { stripClientScope } from "@/lib/blog/admin-utils";
import { blogWhere } from "@/lib/blog/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Los tags del blog de la institución activa: etiquetas que cruzan categorías.
 */
export async function GET() {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  try {
    return NextResponse.json({ tags: await listAdminBlogTags(ctx.workspace.id) });
  } catch (err) {
    return handleBlogApiError(err, "los tags");
  }
}

export async function POST(req: NextRequest) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const parsed = parseContentTagCreate(stripClientScope(await req.json().catch(() => ({}))));
  if (!parsed.success) return validacionFallida(formatContentValidationError(parsed.error));

  try {
    // La institución sale de la sesión y va después de lo validado: no hay forma de pisarla.
    const tag = await prisma.blogTag.create({
      data: { ...parsed.data, ...blogWhere(ctx.workspace.id) },
    });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (err) {
    return handleBlogApiError(err, "el tag");
  }
}
