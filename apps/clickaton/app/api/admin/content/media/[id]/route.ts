import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/admin/db";
import {
  parseRouteId,
  readOptionalText,
  requireContentAdminApi,
} from "@/lib/content/admin-route-utils";
import { deleteBlogImage } from "@/lib/content/blog-storage";
import { handleContentApiError } from "@/lib/content/content-errors";
import { clickatonPlatformWhere, stripClientPlatform } from "@/lib/content/content-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

const MEDIA_TEXT_FIELDS = [
  { field: "title", max: 200 },
  { field: "altText", max: 500 },
  { field: "caption", max: 1000 },
] as const;

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const mediaId = parseRouteId((await params).id);
  if (!mediaId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const media = await prisma.blogMedia.findFirst({
      where: { id: mediaId, ...clickatonPlatformWhere },
    });
    if (!media) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    return NextResponse.json({ media });
  } catch (err) {
    return handleContentApiError(err, "la imagen");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const mediaId = parseRouteId((await params).id);
  if (!mediaId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = stripClientPlatform(
    (await req.json().catch(() => ({}))) as Record<string, unknown>,
  );
  const data: Record<string, string | null> = {};
  for (const { field, max } of MEDIA_TEXT_FIELDS) {
    const parsed = readOptionalText(body, field, max);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: `El campo "${parsed.field}" debe ser texto`, code: "CLICKATON_CONTENT_INVALID" },
        { status: 400 },
      );
    }
    if (parsed.value !== undefined) data[field] = parsed.value;
  }

  try {
    const updated = await prisma.blogMedia.updateMany({
      where: { id: mediaId, ...clickatonPlatformWhere },
      data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }
    const media = await prisma.blogMedia.findFirst({
      where: { id: mediaId, ...clickatonPlatformWhere },
    });
    return NextResponse.json({ media });
  } catch (err) {
    return handleContentApiError(err, "la imagen");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const mediaId = parseRouteId((await params).id);
  if (!mediaId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const media = await prisma.blogMedia.findFirst({
      where: { id: mediaId, ...clickatonPlatformWhere },
    });
    if (!media) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

    // El borrado en storage es best-effort: la fila manda para la biblioteca.
    await deleteBlogImage(media.r2Key).catch((err) => {
      console.error("[clickaton][content] DELETE media storage:", err);
    });
    await prisma.blogMedia.deleteMany({
      where: { id: mediaId, ...clickatonPlatformWhere },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleContentApiError(err, "la imagen");
  }
}
