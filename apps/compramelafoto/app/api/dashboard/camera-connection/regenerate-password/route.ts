import { NextResponse } from "next/server";
import {
  cameraConnectionError,
  cameraConnectionUnauthorized,
  requireCameraConnectionPhotographer,
  toPublicCameraConnectionSettings,
} from "@/lib/camera-connection/camera-connection-api-helpers";
import {
  cameraConnectionSettingsSelect,
  ensureCameraConnectionSettings,
  generateFtpPassword,
  hashFtpPassword,
} from "@/lib/camera-connection/camera-connection-service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { error, user } = await requireCameraConnectionPhotographer();
    if (error || !user) return cameraConnectionUnauthorized(error);

    await ensureCameraConnectionSettings(user.id);

    const plainPassword = generateFtpPassword();
    const ftpPasswordHash = await hashFtpPassword(plainPassword);

    const settings = await prisma.cameraConnectionSettings.update({
      where: { userId: user.id },
      data: { ftpPasswordHash },
      select: cameraConnectionSettingsSelect,
    });

    return NextResponse.json({
      settings: toPublicCameraConnectionSettings(settings),
      plainPassword,
    });
  } catch (err: unknown) {
    console.error("POST /api/dashboard/camera-connection/regenerate-password", err);
    return cameraConnectionError("Error al regenerar la contraseña FTP.");
  }
}
