import { NextRequest, NextResponse } from "next/server";
import { CameraConnectionAssignmentMode } from "@/lib/prisma";
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
} from "@/lib/camera-connection/camera-connection-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error, user } = await requireCameraConnectionPhotographer();
    if (error || !user) return cameraConnectionUnauthorized(error);

    const settings = await ensureCameraConnectionSettings(user.id);
    return NextResponse.json(toPublicCameraConnectionSettings(settings));
  } catch (err: unknown) {
    console.error("GET /api/dashboard/camera-connection/settings", err);
    return cameraConnectionFailure(
      err,
      "Error al cargar la configuración de Conexión de Cámara."
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { error, user } = await requireCameraConnectionPhotographer();
    if (error || !user) return cameraConnectionUnauthorized(error);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return cameraConnectionError("Cuerpo inválido.", 400);
    }

    const data: {
      autoPublish?: boolean;
      assignmentMode?: CameraConnectionAssignmentMode;
    } = {};

    if (body.autoPublish !== undefined) {
      if (typeof body.autoPublish !== "boolean") {
        return cameraConnectionError("autoPublish debe ser boolean.", 400);
      }
      data.autoPublish = body.autoPublish;
    }

    if (body.assignmentMode !== undefined) {
      if (
        body.assignmentMode !== CameraConnectionAssignmentMode.MANUAL &&
        body.assignmentMode !== CameraConnectionAssignmentMode.ALBUM_EVENT_TIME
      ) {
        return cameraConnectionError(
          "assignmentMode debe ser MANUAL o ALBUM_EVENT_TIME.",
          400
        );
      }
      data.assignmentMode = body.assignmentMode;
    }

    if (Object.keys(data).length === 0) {
      return cameraConnectionError(
        "Enviá autoPublish y/o assignmentMode.",
        400
      );
    }

    await ensureCameraConnectionSettings(user.id);

    const settings = await prisma.cameraConnectionSettings.update({
      where: { userId: user.id },
      data,
      select: cameraConnectionSettingsSelect,
    });

    return NextResponse.json(toPublicCameraConnectionSettings(settings));
  } catch (err: unknown) {
    console.error("PATCH /api/dashboard/camera-connection/settings", err);
    return cameraConnectionFailure(err, "Error al actualizar la configuración.");
  }
}
