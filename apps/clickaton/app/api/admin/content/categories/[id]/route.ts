import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentCategoryUpdate } from "@repo/content";
import { prisma } from "@/lib/admin/db";
import { parseRouteId, requireContentAdminApi } from "@/lib/content/admin-route-utils";
import { handleContentApiError } from "@/lib/content/content-errors";
import { clickatonPlatformWhere, stripClientPlatform } from "@/lib/content/content-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const categoryId = parseRouteId((await params).id);
  if (!categoryId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = stripClientPlatform(await req.json().catch(() => ({})));
  const parsed = parseContentCategoryUpdate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatContentValidationError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.blogCategory.updateMany({
      where: { id: categoryId, ...clickatonPlatformWhere },
      data: parsed.data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }
    const category = await prisma.blogCategory.findFirst({
      where: { id: categoryId, ...clickatonPlatformWhere },
    });
    return NextResponse.json({ category });
  } catch (err) {
    return handleContentApiError(err, "la categoría");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const categoryId = parseRouteId((await params).id);
  if (!categoryId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const deleted = await prisma.blogCategory.deleteMany({
      where: { id: categoryId, ...clickatonPlatformWhere },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleContentApiError(err, "la categoría");
  }
}
