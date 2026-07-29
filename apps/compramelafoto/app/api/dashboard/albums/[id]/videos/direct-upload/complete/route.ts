import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getR2ObjectMetadata } from "@/lib/r2-client";
import { ensureAlbumUploadAccess, ensureMpConnected } from "../../../photos/upload-helpers";
import { requireVideoMvpPhotographer } from "@/lib/videos/video-api-guard";
import { toVideoAssetDto } from "@/lib/videos/video-dto";
import { isValidVideoOriginalKeyForAlbum } from "@/lib/videos/video-original-key";
import {
  VideoValidationError,
  resolveVideoPriceCents,
  validateVideoUploadParams,
  videoExpiresAtFromNow,
} from "@/lib/videos/video-validation";
import {
  PhotoEventFolderValidationError,
  resolvePhotoEventFolder,
} from "@/lib/events/resolve-photo-event-folder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireVideoMvpPhotographer();
    if (auth.error) return auth.error;
    const user = auth.user!;

    const mpCheck = await ensureMpConnected(user);
    if (!mpCheck.ok) {
      return NextResponse.json({ error: mpCheck.error }, { status: 403 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const access = await ensureAlbumUploadAccess(albumId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await req.json().catch(() => ({}));
    const originalKey = String(body?.originalKey ?? body?.key ?? "").trim();
    const filename = String(body?.filename ?? body?.originalName ?? "video").trim();
    const contentType = String(body?.contentType ?? "").trim().toLowerCase();
    const sizeBytes = Number(body?.sizeBytes ?? body?.size ?? 0);
    const category = String(body?.category ?? "OTHER");
    const title =
      typeof body?.title === "string" && body.title.trim() ? body.title.trim() : null;
    const description =
      typeof body?.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    if (!originalKey || !isValidVideoOriginalKeyForAlbum(albumId, originalKey)) {
      return NextResponse.json({ error: "originalKey inválida para este álbum" }, { status: 400 });
    }

    let validatedCategory;
    try {
      ({ category: validatedCategory } = validateVideoUploadParams({
        contentType,
        sizeBytes,
        category,
      }));
    } catch (e) {
      if (e instanceof VideoValidationError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    let priceCents: number;
    try {
      const rawPrice = body?.priceCents != null ? Number(body.priceCents) : null;
      priceCents = resolveVideoPriceCents(validatedCategory, rawPrice);
    } catch (e) {
      if (e instanceof VideoValidationError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    let resolvedFolderId: number | undefined;
    try {
      const rf = await resolvePhotoEventFolder({
        albumEventId: access.albumEventId,
        eventFolderIdRaw: body?.eventFolderId,
      });
      resolvedFolderId = rf?.id;
    } catch (e) {
      if (e instanceof PhotoEventFolderValidationError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    let metadataSize = sizeBytes;
    try {
      const meta = await getR2ObjectMetadata(originalKey);
      if (meta.size > 0) metadataSize = meta.size;
    } catch {
      /* usar sizeBytes del cliente */
    }

    try {
      validateVideoUploadParams({
        contentType,
        sizeBytes: metadataSize,
        category: validatedCategory,
      });
    } catch (e) {
      if (e instanceof VideoValidationError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const expiresAt = videoExpiresAtFromNow(0);

    const video = await prisma.$transaction(async (tx) => {
      const created = await tx.videoAsset.create({
        data: {
          albumId,
          userId: user.id,
          eventFolderId: resolvedFolderId ?? null,
          originalKey,
          originalFileName: filename,
          mimeType: contentType,
          fileSizeBytes: BigInt(Math.round(metadataSize)),
          category: validatedCategory,
          title,
          description,
          priceCents,
          expiresAt,
          processingStatus: "UPLOADED",
        },
      });

      await tx.videoProcessingJob.create({
        data: {
          videoId: created.id,
          status: "PENDING",
        },
      });

      return created;
    });

    console.info("[video-upload] complete", {
      albumId,
      videoId: video.id,
      category: validatedCategory,
      sizeBytes: metadataSize,
    });

    return NextResponse.json({ video: toVideoAssetDto(video) }, { status: 201 });
  } catch (err: unknown) {
    console.error("[video-upload] complete error", err);
    return NextResponse.json(
      { error: "Error registrando el video" },
      { status: 500 }
    );
  }
}
