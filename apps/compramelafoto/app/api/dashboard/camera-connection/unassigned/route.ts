import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedUrlForFile } from "@/lib/r2-client";
import {
  cameraConnectionError,
  cameraConnectionFailure,
  cameraConnectionUnauthorized,
  requireCameraConnectionPhotographer,
} from "@/lib/camera-connection/camera-connection-api-helpers";
import { CAMERA_UNASSIGNED_LOG_STATUSES } from "@/lib/camera-connection/camera-connection-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNASSIGNED_LIMIT = 100;

export async function GET() {
  try {
    const { error, user } = await requireCameraConnectionPhotographer();
    if (error || !user) return cameraConnectionUnauthorized(error);

    const logs = await prisma.cameraUploadLog.findMany({
      where: {
        userId: user.id,
        status: { in: [...CAMERA_UNASSIGNED_LOG_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
      take: UNASSIGNED_LIMIT,
      select: {
        id: true,
        filename: true,
        filesize: true,
        status: true,
        errorMessage: true,
        rawKey: true,
        createdAt: true,
      },
    });

    const items = await Promise.all(
      logs.map(async (log) => ({
        id: log.id,
        filename: log.filename,
        filesize: log.filesize,
        status: log.status,
        reason: log.errorMessage,
        receivedAt: log.createdAt.toISOString(),
        hasRawFile: Boolean(log.rawKey),
        previewUrl:
          log.rawKey != null
            ? await getSignedUrlForFile(log.rawKey, 3600).catch(() => null)
            : null,
      }))
    );

    return NextResponse.json({ items, total: items.length });
  } catch (err: unknown) {
    console.error("GET /api/dashboard/camera-connection/unassigned", err);
    return cameraConnectionFailure(err, "Error al cargar fotos sin asignar.");
  }
}
