import { NextRequest, NextResponse } from "next/server";
import {
  cameraConnectionError,
  cameraConnectionFailure,
  cameraConnectionUnauthorized,
  requireCameraConnectionPhotographer,
} from "@/lib/camera-connection/camera-connection-api-helpers";
import { assignUnassignedCameraUploadToAlbum } from "@/lib/camera-connection/assign-unassigned-camera-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireCameraConnectionPhotographer();
    if (error || !user) return cameraConnectionUnauthorized(error);

    const { id } = await Promise.resolve(params);
    const uploadLogId = parseInt(id, 10);
    if (!Number.isFinite(uploadLogId) || uploadLogId <= 0) {
      return cameraConnectionError("ID inválido.", 400);
    }

    const body = await req.json().catch(() => null);
    const albumId = Number(body?.albumId);
    if (!Number.isFinite(albumId) || albumId <= 0) {
      return cameraConnectionError("Enviá albumId (número positivo).", 400);
    }

    const result = await assignUnassignedCameraUploadToAlbum({
      userId: user.id,
      uploadLogId,
      albumId,
    });

    if (!result.ok) {
      return cameraConnectionError(result.error, result.status);
    }

    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      logId: result.logId,
      rawKey: result.rawKey,
    });
  } catch (err: unknown) {
    console.error("POST /api/dashboard/camera-connection/unassigned/[id]/assign", err);
    return cameraConnectionFailure(err, "Error al asignar la foto al álbum.");
  }
}
