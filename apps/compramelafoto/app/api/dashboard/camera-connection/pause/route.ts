import { NextResponse } from "next/server";
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
} from "@/lib/camera-connection/camera-connection-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { error, user } = await requireCameraConnectionPhotographer();
    if (error || !user) return cameraConnectionUnauthorized(error);

    await ensureCameraConnectionSettings(user.id);

    const settings = await prisma.cameraConnectionSettings.update({
      where: { userId: user.id },
      data: { paused: true },
      select: cameraConnectionSettingsSelect,
    });

    return NextResponse.json({
      settings: toPublicCameraConnectionSettings(settings),
    });
  } catch (err: unknown) {
    console.error("POST /api/dashboard/camera-connection/pause", err);
    return cameraConnectionError("Error al pausar Conexión de Cámara.");
  }
}
