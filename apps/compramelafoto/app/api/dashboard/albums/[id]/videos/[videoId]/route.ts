import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VideoCategory } from "@/lib/prisma";
import { requireVideoMvpPhotographer } from "@/lib/videos/video-api-guard";
import { toVideoAssetDto } from "@/lib/videos/video-dto";
import {
  VideoValidationError,
  isVideoCategory,
  resolveVideoPriceCents,
} from "@/lib/videos/video-validation";
import {
  PhotoEventFolderValidationError,
  resolvePhotoEventFolder,
} from "@/lib/events/resolve-photo-event-folder";
import { ensureAlbumUploadAccess } from "../../photos/upload-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadVideoForAlbum(albumId: number, videoId: number) {
  return prisma.videoAsset.findFirst({
    where: { id: videoId, albumId, isRemoved: false },
  });
}

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const auth = await requireVideoMvpPhotographer();
    if (auth.error) return auth.error;
    const user = auth.user!;

    const resolved = await Promise.resolve(params);
    const albumId = parseInt(resolved.id, 10);
    const videoId = parseInt(resolved.videoId, 10);
    if (!Number.isFinite(albumId) || !Number.isFinite(videoId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const access = await ensureAlbumUploadAccess(albumId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const existing = await loadVideoForAlbum(albumId, videoId);
    if (!existing) {
      return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const data: {
      title?: string | null;
      description?: string | null;
      category?: VideoCategory;
      priceCents?: number;
      sellEnabled?: boolean;
      eventFolderId?: number | null;
    } = {};

    if (body.title !== undefined) {
      data.title =
        typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
    }
    if (body.description !== undefined) {
      data.description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null;
    }

    const nextCategory = body.category != null ? String(body.category).toUpperCase() : existing.category;
    if (body.category !== undefined) {
      if (!isVideoCategory(nextCategory)) {
        return NextResponse.json({ error: "Categoría no válida" }, { status: 400 });
      }
      data.category = nextCategory;
    }

    if (body.priceCents !== undefined) {
      try {
        data.priceCents = resolveVideoPriceCents(
          data.category ?? existing.category,
          Number(body.priceCents)
        );
      } catch (e) {
        if (e instanceof VideoValidationError) {
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
        throw e;
      }
    }

    if (body.sellEnabled !== undefined) {
      data.sellEnabled = Boolean(body.sellEnabled);
    }

    if (body.eventFolderId !== undefined) {
      try {
        const rf = await resolvePhotoEventFolder({
          albumEventId: access.albumEventId,
          eventFolderIdRaw: body.eventFolderId,
        });
        data.eventFolderId = rf?.id ?? null;
      } catch (e) {
        if (e instanceof PhotoEventFolderValidationError) {
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
        throw e;
      }
    }

    const updated = await prisma.videoAsset.update({
      where: { id: videoId },
      data,
    });

    return NextResponse.json({ video: toVideoAssetDto(updated) });
  } catch (err: unknown) {
    console.error("[videos] patch error", err);
    return NextResponse.json({ error: "Error actualizando video" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const auth = await requireVideoMvpPhotographer();
    if (auth.error) return auth.error;
    const user = auth.user!;

    const resolved = await Promise.resolve(params);
    const albumId = parseInt(resolved.id, 10);
    const videoId = parseInt(resolved.videoId, 10);
    if (!Number.isFinite(albumId) || !Number.isFinite(videoId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const access = await ensureAlbumUploadAccess(albumId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const existing = await loadVideoForAlbum(albumId, videoId);
    if (!existing) {
      return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
    }

    await prisma.videoAsset.update({
      where: { id: videoId },
      data: { isRemoved: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[videos] delete error", err);
    return NextResponse.json({ error: "Error eliminando video" }, { status: 500 });
  }
}
