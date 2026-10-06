import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentTagUpdate } from "@repo/content";
import { prisma } from "@repo/db";
import { parseRouteId, requireBlogEditorApi } from "@/lib/blog/access";
import { handleBlogApiError, idInvalido, validacionFallida } from "@/lib/blog/admin-errors";
import { stripClientScope } from "@/lib/blog/admin-utils";
import { blogWhere } from "@/lib/blog/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

const noEncontrado = () => NextResponse.json({ error: "Tag no encontrado" }, { status: 404 });

/*
  `updateMany` / `deleteMany` con el filtro de la institución en vez de `update` / `delete`
  por id: un id de otra institución no encuentra nada (404) en lugar de tocar su fila.
*/
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const id = parseRouteId((await params).id);
  if (!id) return idInvalido();

  const parsed = parseContentTagUpdate(stripClientScope(await req.json().catch(() => ({}))));
  if (!parsed.success) return validacionFallida(formatContentValidationError(parsed.error));

  try {
    const where = { id, ...blogWhere(ctx.workspace.id) };
    const updated = await prisma.blogTag.updateMany({ where, data: parsed.data });
    if (updated.count === 0) return noEncontrado();
    const tag = await prisma.blogTag.findFirst({ where });
    return NextResponse.json({ tag });
  } catch (err) {
    return handleBlogApiError(err, "el tag");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const id = parseRouteId((await params).id);
  if (!id) return idInvalido();

  try {
    const deleted = await prisma.blogTag.deleteMany({ where: { id, ...blogWhere(ctx.workspace.id) } });
    return deleted.count === 0 ? noEncontrado() : NextResponse.json({ ok: true });
  } catch (err) {
    return handleBlogApiError(err, "el tag");
  }
}
