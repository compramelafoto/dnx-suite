import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentAuthorCreate } from "@repo/content";
import { prisma } from "@repo/db";
import { requireBlogEditorApi } from "@/lib/blog/access";
import { handleBlogApiError, validacionFallida } from "@/lib/blog/admin-errors";
import { listAdminBlogAuthors } from "@/lib/blog/admin-queries";
import { stripClientScope } from "@/lib/blog/admin-utils";
import { blogWhere } from "@/lib/blog/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Los autores del blog de la institución activa. Son opcionales: un artículo puede no tener autor.
 * `?active=1` trae sólo los disponibles para asignar (lo que usa el formulario del artículo).
 */
export async function GET(req: NextRequest) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  try {
    return NextResponse.json({ authors: await listAdminBlogAuthors(ctx.workspace.id, {
      activeOnly: new URL(req.url).searchParams.get("active") === "1",
    }) });
  } catch (err) {
    return handleBlogApiError(err, "los autores");
  }
}

export async function POST(req: NextRequest) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const parsed = parseContentAuthorCreate(stripClientScope(await req.json().catch(() => ({}))));
  if (!parsed.success) return validacionFallida(formatContentValidationError(parsed.error));

  try {
    // La institución sale de la sesión y va después de lo validado: no hay forma de pisarla.
    const author = await prisma.blogAuthor.create({
      data: { ...parsed.data, ...blogWhere(ctx.workspace.id) },
    });
    return NextResponse.json({ author }, { status: 201 });
  } catch (err) {
    return handleBlogApiError(err, "el autor");
  }
}
