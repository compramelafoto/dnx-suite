import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  cameraConnectionError,
  cameraConnectionFailure,
  cameraConnectionUnauthorized,
  requireCameraConnectionPhotographer,
  toPublicCameraConnectionSettings,
} from "@/lib/camera-connection/camera-connection-api-helpers";
import {
  cameraConnectionSettingsSelect,
  ensureCameraConnectionSettings,
  generateFtpPassword,
  generateFtpUsername,
  hashFtpPassword,
  shouldRegenerateFtpUsername,
} from "@/lib/camera-connection/camera-connection-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { error, user } = await requireCameraConnectionPhotographer();
    if (error || !user) return cameraConnectionUnauthorized(error);

    const existing = await ensureCameraConnectionSettings(user.id);

    const updateData: {
      enabled: boolean;
      ftpUsername?: string;
      ftpPasswordHash?: string;
    } = { enabled: true };

    let plainPassword: string | undefined;

    if (shouldRegenerateFtpUsername(existing.ftpUsername)) {
      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, handler: true },
      });
      if (!profile) {
        return cameraConnectionError("Usuario no encontrado.", 404);
      }
      updateData.ftpUsername = await generateFtpUsername(profile);
    }

    if (!existing.ftpPasswordHash?.trim()) {
      plainPassword = generateFtpPassword();
      updateData.ftpPasswordHash = await hashFtpPassword(plainPassword);
    }

    const settings = await prisma.cameraConnectionSettings.update({
      where: { userId: user.id },
      data: updateData,
      select: cameraConnectionSettingsSelect,
    });

    return NextResponse.json({
      settings: toPublicCameraConnectionSettings(settings),
      ...(plainPassword ? { plainPassword } : {}),
    });
  } catch (err: unknown) {
    console.error("POST /api/dashboard/camera-connection/enable", err);
    return cameraConnectionFailure(err, "Error al activar Conexión de Cámara.");
  }
}
