/**
 * Helpers compartidos por endpoints del panel (configuración Conexión de Cámara).
 */

import { NextResponse } from "next/server";
import { CameraConnectionAssignmentMode, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import type { CameraConnectionSettingsDto } from "@/lib/camera-connection/camera-connection-service";
import {
  FTP_PASSWORD_LENGTH,
  FTP_USERNAME_MAX_LENGTH,
} from "@/lib/camera-connection/camera-connection-service";

export async function requireCameraConnectionPhotographer() {
  return requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
}

export function getCameraConnectionFtpHost(): string {
  const host = process.env.CAMERA_CONNECTION_FTP_HOST?.trim();
  return host || "ftp.compramelafoto.com";
}

export function getCameraConnectionFtpPort(): number {
  const raw = process.env.CAMERA_CONNECTION_FTP_PORT?.trim();
  if (!raw) return 21;
  const port = Number.parseInt(raw, 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return 21;
  return port;
}

/** `true` solo cuando el FTP Gateway está desplegado y operativo. */
export function isCameraConnectionFtpServerLive(): boolean {
  const raw = process.env.CAMERA_CONNECTION_FTP_SERVER_LIVE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * Carpeta remota que la cámara puede pedir como “directorio destino”.
 * Con álbum activo: subcarpeta raw del pipeline (`albums/{id}/raw`).
 * Sin álbum: `/` hasta elegir álbum en el panel.
 */
export function getCameraConnectionFtpRemoteDirectory(
  activeAlbumId: number | null | undefined,
  assignmentMode: CameraConnectionAssignmentMode = CameraConnectionAssignmentMode.MANUAL
): { recommended: string; technical: string | null } {
  if (
    assignmentMode === CameraConnectionAssignmentMode.ALBUM_EVENT_TIME ||
    activeAlbumId == null
  ) {
    return {
      recommended: "/",
      technical: null,
    };
  }
  const path = `albums/${activeAlbumId}/raw`;
  return {
    recommended: "/",
    technical: path,
  };
}

/** Respuesta pública de settings (sin `ftpPasswordHash`). */
export function toPublicCameraConnectionSettings(
  settings: CameraConnectionSettingsDto
) {
  const remoteDirectory = getCameraConnectionFtpRemoteDirectory(
    settings.activeAlbumId,
    settings.assignmentMode
  );
  return {
    enabled: settings.enabled,
    paused: settings.paused,
    activeAlbumId: settings.activeAlbumId,
    assignmentMode: settings.assignmentMode,
    autoPublish: settings.autoPublish,
    lastUploadAt: settings.lastUploadAt?.toISOString() ?? null,
    host: getCameraConnectionFtpHost(),
    port: getCameraConnectionFtpPort(),
    username: settings.ftpUsername,
    hasPassword: Boolean(settings.ftpPasswordHash?.trim()),
    ftpServerLive: isCameraConnectionFtpServerLive(),
    remoteDirectoryRecommended: remoteDirectory.recommended,
    remoteDirectoryTechnical: remoteDirectory.technical,
    credentialLimits: {
      maxUsernameLength: FTP_USERNAME_MAX_LENGTH,
      passwordLength: FTP_PASSWORD_LENGTH,
    },
  };
}

export function cameraConnectionUnauthorized(
  error: string | null
): NextResponse {
  return NextResponse.json(
    { error: error || "No autorizado." },
    { status: 401 }
  );
}

export function cameraConnectionError(
  message: string,
  status: number = 500
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Mensaje HTTP accionable a partir de errores Prisma / cliente desactualizado. */
export function serializeCameraConnectionError(
  err: unknown,
  fallback: string
): { message: string; status: number } {
  const prismaCode =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: string }).code)
      : "";
  const rawMessage = err instanceof Error ? err.message : String(err ?? "");

  if (
    prismaCode === "P2021" ||
    (/CameraConnectionSettings|CameraUploadLog/i.test(rawMessage) &&
      /does not exist|not exist/i.test(rawMessage))
  ) {
    return {
      message:
        "Falta aplicar la migración de Conexión de Cámara. Ejecutá: npx prisma migrate deploy",
      status: 503,
    };
  }

  if (
    rawMessage.includes("PRISMA_CLIENT_OUTDATED") ||
    /Cannot read properties of undefined \(reading '(findUnique|upsert|update|create|findFirst)'\)/.test(
      rawMessage
    )
  ) {
    return {
      message:
        "Reiniciá el servidor de desarrollo (detené y volvé a ejecutar npm run dev) después de npx prisma generate.",
      status: 503,
    };
  }

  if (prismaCode === "P2002") {
    return {
      message:
        "Conflicto con un usuario FTP existente. Probá de nuevo o contactá soporte.",
      status: 409,
    };
  }

  if (process.env.NODE_ENV === "development" && rawMessage) {
    return { message: `${fallback} (${rawMessage})`, status: 500 };
  }

  return { message: fallback, status: 500 };
}

export function cameraConnectionFailure(
  err: unknown,
  fallback: string
): NextResponse {
  const { message, status } = serializeCameraConnectionError(err, fallback);
  return cameraConnectionError(message, status);
}
