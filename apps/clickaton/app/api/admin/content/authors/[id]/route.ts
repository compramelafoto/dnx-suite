import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentAuthorUpdate } from "@repo/content";
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

  const authorId = parseRouteId((await params).id);
  if (!authorId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = stripClientPlatform(await req.json().catch(() => ({})));
  const parsed = parseContentAuthorUpdate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatContentValidationError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.blogAuthor.updateMany({
      where: { id: authorId, ...clickatonPlatformWhere },
      data: parsed.data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Autor no encontrado" }, { status: 404 });
    }
    const author = await prisma.blogAuthor.findFirst({
      where: { id: authorId, ...clickatonPlatformWhere },
    });
    return NextResponse.json({ author });
  } catch (err) {
    return handleContentApiError(err, "el autor");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const authorId = parseRouteId((await params).id);
  if (!authorId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const deleted = await prisma.blogAuthor.deleteMany({
      where: { id: authorId, ...clickatonPlatformWhere },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Autor no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleContentApiError(err, "el autor");
  }
}
