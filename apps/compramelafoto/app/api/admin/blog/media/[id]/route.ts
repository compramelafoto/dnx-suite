import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2-client";
import {
  handleBlogPrismaError,
  parseRouteId,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import { formatBlogValidationError } from "@/lib/blog/validate-blog-category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

const mediaUpdateSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  altText: z.string().max(500).optional().nullable(),
  caption: z.string().max(1000).optional().nullable(),
});

function normalizeOptionalString(value: string | null | undefined, max: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const mediaId = parseRouteId(id);
  if (!mediaId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const media = await prisma.blogMedia.findUnique({ where: { id: mediaId } });
  if (!media) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

  return NextResponse.json({ media });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const mediaId = parseRouteId(id);
  if (!mediaId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = mediaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatBlogValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const media = await prisma.blogMedia.update({
      where: { id: mediaId },
      data: {
        title: normalizeOptionalString(parsed.data.title, 200),
        altText: normalizeOptionalString(parsed.data.altText, 500),
        caption: normalizeOptionalString(parsed.data.caption, 1000),
      },
    });
    return NextResponse.json({ media });
  } catch (err) {
    return handleBlogPrismaError(err, "la imagen");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { id } = await Promise.resolve(params);
  const mediaId = parseRouteId(id);
  if (!mediaId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const media = await prisma.blogMedia.findUnique({ where: { id: mediaId } });
  if (!media) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

  try {
    if (media.r2Key) {
      await deleteFromR2(media.r2Key).catch((err) => {
        console.error("DELETE /api/admin/blog/media/[id] R2:", err);
      });
    }
    await prisma.blogMedia.delete({ where: { id: mediaId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleBlogPrismaError(err, "la imagen");
  }
}
