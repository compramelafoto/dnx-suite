import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  cameraConnectionError,
  cameraConnectionUnauthorized,
  requireCameraConnectionPhotographer,
  toPublicCameraConnectionSettings,
} from "@/lib/camera-connection/camera-connection-api-helpers";
import {
  cameraConnectionSettingsSelect,
  ensureCameraConnectionSettings,
  validateActiveAlbumForCameraConnection,
} from "@/lib/camera-connection/camera-connection-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireCameraConnectionPhotographer();
    if (error || !user) return cameraConnectionUnauthorized(error);

    const body = await req.json().catch(() => null);
    const albumId = Number(body?.albumId);
    if (!Number.isFinite(albumId) || albumId <= 0) {
      return cameraConnectionError("albumId inválido.", 400);
    }

    const access = await validateActiveAlbumForCameraConnection(user.id, albumId);
    if (!access.ok) {
      return cameraConnectionError(access.error, access.status);
    }

    await ensureCameraConnectionSettings(user.id);

    const settings = await prisma.cameraConnectionSettings.update({
      where: { userId: user.id },
      data: { activeAlbumId: albumId },
      select: cameraConnectionSettingsSelect,
    });

    return NextResponse.json({
      settings: toPublicCameraConnectionSettings(settings),
      album: access.album,
    });
  } catch (err: unknown) {
    console.error("POST /api/dashboard/camera-connection/select-album", err);
    return cameraConnectionError("Error al seleccionar el álbum activo.");
  }
}
