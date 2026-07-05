/**
 * Servicio de dominio para Conexión de Cámara.
 * Usado por endpoints de configuración, panel del fotógrafo y FTP Gateway (futuro).
 */

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { CameraUploadLog, Prisma } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  type CameraConnectionUserRef,
  type CreateCameraUploadLogInput,
  type ValidateActiveAlbumResult,
  isCameraUploadLogStatus,
} from "@/lib/camera-connection/camera-connection-types";

const FTP_BCRYPT_ROUNDS = 10;
/** Muchas cámaras limitan la contraseña FTP a 8–16 caracteres. */
export const FTP_PASSWORD_LENGTH = 8;
/** Usuario corto compatible con menús de cámara (p. ej. Sony/Nikon/Fuji). */
export const FTP_USERNAME_MAX_LENGTH = 12;
/** Sin caracteres ambiguos (0/O, 1/l/I) para tipear en la cámara. */
const FTP_PASSWORD_CHARSET = "abcdefghjkmnpqrstuvwxyz23456789";

export const cameraConnectionSettingsSelect = {
  id: true,
  userId: true,
  enabled: true,
  paused: true,
  ftpUsername: true,
  ftpPasswordHash: true,
  activeAlbumId: true,
  assignmentMode: true,
  autoPublish: true,
  lastUploadAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CameraConnectionSettingsSelect;

export type CameraConnectionSettingsDto = Prisma.CameraConnectionSettingsGetPayload<{
  select: typeof cameraConnectionSettingsSelect;
}>;

function assertCameraConnectionPrismaReady(): void {
  const delegate = (
    prisma as { cameraConnectionSettings?: { findUnique?: unknown } }
  ).cameraConnectionSettings;
  if (!delegate?.findUnique) {
    throw new Error(
      "PRISMA_CLIENT_OUTDATED: Reiniciá el servidor de desarrollo después de npx prisma generate."
    );
  }
}

/** Obtiene la configuración del fotógrafo o `null` si nunca se creó. */
export async function getCameraConnectionSettings(
  userId: number
): Promise<CameraConnectionSettingsDto | null> {
  assertCameraConnectionPrismaReady();
  return prisma.cameraConnectionSettings.findUnique({
    where: { userId },
    select: cameraConnectionSettingsSelect,
  });
}

/**
 * Garantiza una fila de configuración con valores por defecto (deshabilitada, sin álbum activo).
 * Idempotente: no sobrescribe credenciales ni flags existentes.
 */
export async function ensureCameraConnectionSettings(
  userId: number
): Promise<CameraConnectionSettingsDto> {
  assertCameraConnectionPrismaReady();
  return prisma.cameraConnectionSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: cameraConnectionSettingsSelect,
  });
}

/**
 * Username FTP único, estable y corto (`u35`, `u1234`).
 * El id de usuario garantiza unicidad global sin prefijos largos.
 */
export async function generateFtpUsername(
  user: CameraConnectionUserRef
): Promise<string> {
  let candidate = `u${user.id}`;
  if (candidate.length > FTP_USERNAME_MAX_LENGTH) {
    candidate = `u${user.id.toString(36)}`;
  }
  if (candidate.length > FTP_USERNAME_MAX_LENGTH) {
    candidate = candidate.slice(0, FTP_USERNAME_MAX_LENGTH);
  }
  return candidate;
}

export function shouldRegenerateFtpUsername(current: string | null | undefined): boolean {
  const value = current?.trim();
  if (!value) return true;
  if (value.startsWith("cmf_")) return true;
  return value.length > FTP_USERNAME_MAX_LENGTH;
}

/** Contraseña aleatoria para mostrar una sola vez al fotógrafo (no persistir en claro). */
export function generateFtpPassword(): string {
  const bytes = randomBytes(FTP_PASSWORD_LENGTH);
  let password = "";
  for (let i = 0; i < FTP_PASSWORD_LENGTH; i += 1) {
    password += FTP_PASSWORD_CHARSET[bytes[i]! % FTP_PASSWORD_CHARSET.length];
  }
  return password;
}

/** Hash bcrypt para almacenar en `ftpPasswordHash` (misma librería que auth de usuarios). */
export async function hashFtpPassword(password: string): Promise<string> {
  return bcrypt.hash(password, FTP_BCRYPT_ROUNDS);
}

/** Verificación para el futuro FTP Gateway. */
export async function verifyFtpPassword(
  password: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash?.trim()) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Valida que el álbum exista, no esté eliminado y que el fotógrafo pueda subir fotos a él.
 * Misma regla de colaboración que la subida manual (`ensureAlbumUploadAccess`).
 */
export async function validateActiveAlbumForCameraConnection(
  userId: number,
  albumId: number
): Promise<ValidateActiveAlbumResult> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      title: true,
      eventId: true,
      userId: true,
      isPublic: true,
      isHidden: true,
      deletedAt: true,
    },
  });

  if (!album || album.deletedAt != null) {
    return { ok: false, error: "Álbum no encontrado", status: 404 };
  }

  if (album.userId !== userId) {
    if (!album.isPublic || album.isHidden) {
      return {
        ok: false,
        error: "Este álbum no permite colaboración. Solo el creador puede usarlo.",
        status: 403,
      };
    }
  }

  return {
    ok: true,
    album: {
      id: album.id,
      title: album.title,
      eventId: album.eventId,
    },
  };
}

/** Crea un registro de auditoría/operación en `CameraUploadLog`. */
export async function createCameraUploadLog(
  data: CreateCameraUploadLogInput
): Promise<CameraUploadLog> {
  if (!isCameraUploadLogStatus(data.status)) {
    throw new Error(`Estado de log inválido: ${data.status}`);
  }

  return prisma.cameraUploadLog.create({
    data: {
      userId: data.userId,
      albumId: data.albumId ?? null,
      filename: data.filename,
      filesize: data.filesize ?? null,
      status: data.status,
      errorMessage: data.errorMessage ?? null,
      rawKey: data.rawKey?.trim() || null,
    },
  });
}
