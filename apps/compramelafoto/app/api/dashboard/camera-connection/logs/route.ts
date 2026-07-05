import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  cameraConnectionError,
  cameraConnectionUnauthorized,
  requireCameraConnectionPhotographer,
} from "@/lib/camera-connection/camera-connection-api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGS_LIMIT = 50;

export async function GET() {
  try {
    const { error, user } = await requireCameraConnectionPhotographer();
    if (error || !user) return cameraConnectionUnauthorized(error);

    const logs = await prisma.cameraUploadLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: LOGS_LIMIT,
      select: {
        id: true,
        albumId: true,
        filename: true,
        filesize: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        album: {
          select: { title: true },
        },
      },
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        albumId: log.albumId,
        albumTitle: log.album?.title ?? null,
        filename: log.filename,
        filesize: log.filesize,
        status: log.status,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    console.error("GET /api/dashboard/camera-connection/logs", err);
    return cameraConnectionError("Error al cargar el historial de subidas.");
  }
}
