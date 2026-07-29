import { NextRequest, NextResponse } from "next/server";
import { getSignedPutUrl } from "@/lib/r2-client";
import { ensureAlbumUploadAccess, ensureMpConnected } from "../../../photos/upload-helpers";
import { requireVideoMvpPhotographer } from "@/lib/videos/video-api-guard";
import { buildVideoOriginalR2Key, isValidVideoOriginalKeyForAlbum } from "@/lib/videos/video-original-key";
import {
  VideoValidationError,
  validateVideoUploadParams,
  VIDEO_LIMITS_BY_CATEGORY,
} from "@/lib/videos/video-validation";

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
    const filename = String(body?.filename ?? body?.name ?? "").trim();
    const contentType = String(body?.contentType ?? "").trim().toLowerCase();
    const sizeBytes = Number(body?.sizeBytes ?? body?.size ?? 0);
    const category = String(body?.category ?? "OTHER");

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Faltan filename o contentType" }, { status: 400 });
    }

    let validated;
    try {
      validated = validateVideoUploadParams({ contentType, sizeBytes, category });
    } catch (e) {
      if (e instanceof VideoValidationError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const key = buildVideoOriginalR2Key(albumId, contentType);
    if (!isValidVideoOriginalKeyForAlbum(albumId, key)) {
      return NextResponse.json({ error: "No se pudo generar la key de subida" }, { status: 500 });
    }

    const uploadUrl = await getSignedPutUrl(key, contentType, 900);
    const maxBytes = VIDEO_LIMITS_BY_CATEGORY[validated.category].maxBytes;
    const maxMb = Math.round(maxBytes / (1024 * 1024));

    return NextResponse.json({
      uploadUrl,
      key,
      maxBytes,
      maxMb,
      category: validated.category,
    });
  } catch (err: unknown) {
    console.error("[video-upload] init error", err);
    return NextResponse.json(
      { error: "Error generando URL de subida de video" },
      { status: 500 }
    );
  }
}
