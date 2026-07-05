import { randomUUID } from "node:crypto";
import { generateR2Key, uploadToR2, deleteFromR2 } from "@/lib/r2-client.js";
import { createCameraUploadLogAndEnqueue } from "@/lib/camera-connection/create-camera-upload-log-and-enqueue.js";
import { createCameraUploadLog } from "@/lib/camera-connection/camera-connection-service.js";
import { CAMERA_UPLOAD_LOG_STATUS } from "@/lib/camera-connection/camera-connection-types.js";
import { buildCameraUnassignedRawKey } from "@/lib/camera-connection/camera-unassigned-raw.js";
import {
  FTP_DESTINATION_REASON,
  resolveFtpDestinationAlbum,
} from "@/lib/camera-connection/resolve-ftp-destination-album.js";
import { FileSystemError } from "ftp-srv";
import type { CameraFtpAuthContext } from "./authenticate.js";
import type { GatewayConfig } from "./config.js";
import { logError, logInfo, logWarn } from "./logger.js";
import {
  checkUploadRateLimit,
  rateLimitKey,
  recordSuccessfulUpload,
} from "./rate-limit.js";

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

export function sanitizeUploadBasename(fileName: string): string {
  const normalized = fileName.replace(/\\/g, "/").trim();
  if (normalized.includes("..")) {
    throw new FileSystemError("Path traversal not allowed", 550);
  }

  const base = normalized.split("/").filter(Boolean).pop();
  if (!base) {
    throw new FileSystemError("Invalid file name", 550);
  }

  return base;
}

export function assertAllowedJpegFilename(filename: string): void {
  if (!/\.jpe?g$/i.test(filename)) {
    throw new FileSystemError("Only JPG/JPEG files are allowed", 550);
  }
}

export function assertJpegMagicBytes(buffer: Buffer): void {
  if (buffer.length < JPEG_MAGIC.length) {
    throw new FileSystemError("Invalid JPEG file", 550);
  }

  if (!buffer.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) {
    throw new FileSystemError("Invalid JPEG file", 550);
  }
}

export type HandleUploadResult =
  | {
      rawKey: string;
      jobId: string;
      logId: number;
      created: boolean;
      bytes: number;
      status: "queued";
    }
  | {
      rawKey: string;
      logId: number;
      bytes: number;
      status: "unassigned";
    };

function logStatusForDestinationReason(
  reason: (typeof FTP_DESTINATION_REASON)[keyof typeof FTP_DESTINATION_REASON]
): (typeof CAMERA_UPLOAD_LOG_STATUS)[keyof typeof CAMERA_UPLOAD_LOG_STATUS] {
  if (reason === FTP_DESTINATION_REASON.AMBIGUOUS_ALBUM_TIME_MATCH) {
    return CAMERA_UPLOAD_LOG_STATUS.AMBIGUOUS_ALBUM_TIME_MATCH;
  }
  return CAMERA_UPLOAD_LOG_STATUS.UNASSIGNED;
}

async function createRejectedUploadLog(
  auth: CameraFtpAuthContext,
  filename: string,
  filesizeBytes: number,
  errorMessage: string,
  albumId: number | null = auth.activeAlbumId,
  status: (typeof CAMERA_UPLOAD_LOG_STATUS)[keyof typeof CAMERA_UPLOAD_LOG_STATUS] = CAMERA_UPLOAD_LOG_STATUS.REJECTED,
  rawKey?: string | null
): Promise<number | null> {
  try {
    const log = await createCameraUploadLog({
      userId: auth.userId,
      albumId,
      filename,
      filesize: filesizeBytes,
      status,
      errorMessage,
      rawKey: rawKey ?? null,
    });
    return log.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logWarn("rejected_log_failed", {
      username: auth.ftpUsername,
      userId: auth.userId,
      albumId: albumId ?? undefined,
      filename,
      size: filesizeBytes,
      status,
      error: message,
    });
    return null;
  }
}

async function storeUnassignedUpload(
  auth: CameraFtpAuthContext,
  filename: string,
  buffer: Buffer,
  status: (typeof CAMERA_UPLOAD_LOG_STATUS)[keyof typeof CAMERA_UPLOAD_LOG_STATUS],
  errorMessage: string
): Promise<HandleUploadResult> {
  const stagingKey = buildCameraUnassignedRawKey(auth.userId, filename);
  let r2Uploaded = false;

  try {
    await uploadToR2(buffer, stagingKey, "image/jpeg");
    r2Uploaded = true;

    const log = await createCameraUploadLog({
      userId: auth.userId,
      albumId: null,
      filename,
      filesize: buffer.length,
      status,
      errorMessage,
      rawKey: stagingKey,
    });

    logInfo("upload_unassigned_stored", {
      username: auth.ftpUsername,
      userId: auth.userId,
      filename,
      size: buffer.length,
      status,
      logId: log.id,
      rawKey: stagingKey,
    });

    return {
      rawKey: stagingKey,
      logId: log.id,
      bytes: buffer.length,
      status: "unassigned",
    };
  } catch (err) {
    if (r2Uploaded) {
      try {
        await deleteFromR2(stagingKey);
      } catch {
        // ignore cleanup failure
      }
    }
    throw err instanceof FileSystemError
      ? err
      : new FileSystemError(
          err instanceof Error ? err.message : "No se pudo guardar la foto sin asignar",
          550
        );
  }
}

/**
 * Sube raw a R2 y encola log + job. No llama a finalize.
 */
export async function handleCameraFtpUpload(
  config: GatewayConfig,
  auth: CameraFtpAuthContext,
  filename: string,
  buffer: Buffer
): Promise<HandleUploadResult> {
  if (buffer.length === 0) {
    throw new FileSystemError("Empty file", 550);
  }

  if (buffer.length > config.FTP_MAX_UPLOAD_BYTES) {
    const maxMb = Math.round(config.FTP_MAX_UPLOAD_BYTES / 1024 / 1024);
    throw new FileSystemError(`File exceeds ${maxMb}MB limit`, 550);
  }

  const limitKey = rateLimitKey(auth.userId, auth.ftpUsername);
  const rateCheck = checkUploadRateLimit(config, limitKey);
  if (!rateCheck.allowed) {
    const windowMinutes = Math.round(config.FTP_RATE_LIMIT_WINDOW_MS / 60_000);
    const errorMessage = `Límite de subida alcanzado (${config.FTP_RATE_LIMIT_MAX_FILES} archivos cada ${windowMinutes} minutos). Reintentá en ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.`;

    const logId = await createRejectedUploadLog(
      auth,
      filename,
      buffer.length,
      errorMessage,
      auth.activeAlbumId
    );

    logWarn("upload_rate_limited", {
      username: auth.ftpUsername,
      userId: auth.userId,
      albumId: auth.activeAlbumId ?? undefined,
      filename,
      size: buffer.length,
      status: CAMERA_UPLOAD_LOG_STATUS.REJECTED,
      logId: logId ?? undefined,
      retryAfterMs: rateCheck.retryAfterMs,
    });

    throw new FileSystemError(errorMessage, 550);
  }

  assertJpegMagicBytes(buffer);

  const receivedAt = new Date();
  const destination = await resolveFtpDestinationAlbum({
    userId: auth.userId,
    receivedAt,
    assignmentMode: auth.assignmentMode,
    activeAlbumId: auth.activeAlbumId,
  });

  if (!destination.ok) {
    const status = logStatusForDestinationReason(destination.reason);
    const result = await storeUnassignedUpload(
      auth,
      filename,
      buffer,
      status,
      destination.message
    );
    recordSuccessfulUpload(limitKey);
    return result;
  }

  const albumId = destination.albumId;
  const logBase = {
    username: auth.ftpUsername,
    userId: auth.userId,
    albumId,
    filename,
    size: buffer.length,
    assignmentMode: auth.assignmentMode,
  };

  const rawKey = generateR2Key(filename, `albums/${albumId}/raw`);
  let r2Uploaded = false;

  try {
    await uploadToR2(buffer, rawKey, "image/jpeg");
    r2Uploaded = true;

    const { job, log, created } = await createCameraUploadLogAndEnqueue({
      userId: auth.userId,
      albumId,
      rawKey,
      filename,
      filesizeBytes: buffer.length,
    });

    recordSuccessfulUpload(limitKey);

    logInfo("upload_queued", {
      ...logBase,
      rawKey,
      status: "queued",
      jobId: job.id,
      logId: log.id,
      created,
    });

    return {
      rawKey,
      jobId: job.id,
      logId: log.id,
      created,
      bytes: buffer.length,
      status: "queued",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorId = randomUUID();

    if (r2Uploaded) {
      try {
        await deleteFromR2(rawKey);
        logWarn("orphan_raw_deleted", {
          ...logBase,
          rawKey,
          status: "enqueue_failed_cleanup",
          errorId,
          error: message,
        });
      } catch (deleteErr) {
        const deleteMessage = deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
        logError("orphan_raw_delete_failed", {
          ...logBase,
          rawKey,
          status: "enqueue_failed",
          errorId,
          error: message,
          deleteError: deleteMessage,
        });
      }
    }

    logError("upload_failed", {
      ...logBase,
      rawKey,
      status: "failed",
      errorId,
      error: message,
      r2Uploaded,
    });

    throw err instanceof FileSystemError
      ? err
      : new FileSystemError(message || "Upload failed", 550);
  }
}
