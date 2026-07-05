/**
 * Tipos y constantes de dominio para Conexión de Cámara.
 * Consumidos por endpoints de configuración, panel del fotógrafo y FTP Gateway.
 */

/** Estados posibles de un intento de subida vía FTP / Conexión de Cámara. */
export const CAMERA_UPLOAD_LOG_STATUS = {
  RECEIVED: "RECEIVED",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  REJECTED: "REJECTED",
  NO_ACTIVE_ALBUM: "NO_ACTIVE_ALBUM",
  UNASSIGNED: "UNASSIGNED",
  AMBIGUOUS_ALBUM_TIME_MATCH: "AMBIGUOUS_ALBUM_TIME_MATCH",
  PAUSED: "PAUSED",
  DISABLED: "DISABLED",
} as const;

export type CameraUploadLogStatus =
  (typeof CAMERA_UPLOAD_LOG_STATUS)[keyof typeof CAMERA_UPLOAD_LOG_STATUS];

export const CAMERA_UPLOAD_LOG_STATUSES = Object.values(
  CAMERA_UPLOAD_LOG_STATUS
) as CameraUploadLogStatus[];

export function isCameraUploadLogStatus(value: string): value is CameraUploadLogStatus {
  return (CAMERA_UPLOAD_LOG_STATUSES as string[]).includes(value);
}

/** Referencia mínima de usuario para generar credenciales FTP. */
export type CameraConnectionUserRef = {
  id: number;
  handler?: string | null;
};

export const CAMERA_UNASSIGNED_LOG_STATUSES = [
  CAMERA_UPLOAD_LOG_STATUS.UNASSIGNED,
  CAMERA_UPLOAD_LOG_STATUS.AMBIGUOUS_ALBUM_TIME_MATCH,
] as const;

export type CameraUnassignedLogStatus =
  (typeof CAMERA_UNASSIGNED_LOG_STATUSES)[number];

export function isCameraUnassignedLogStatus(
  status: string
): status is CameraUnassignedLogStatus {
  return (CAMERA_UNASSIGNED_LOG_STATUSES as readonly string[]).includes(status);
}

export type CreateCameraUploadLogInput = {
  userId: number;
  albumId?: number | null;
  filename: string;
  filesize?: number | null;
  status: CameraUploadLogStatus;
  errorMessage?: string | null;
  rawKey?: string | null;
};

export type ValidateActiveAlbumResult =
  | {
      ok: true;
      album: {
        id: number;
        title: string;
        eventId: number | null;
      };
    }
  | {
      ok: false;
      error: string;
      status: 404 | 403;
    };
