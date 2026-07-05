import { CameraConnectionAssignmentMode } from "@repo/db";
import { FileSystemError, GeneralError } from "ftp-srv";
import {
  validateActiveAlbumForCameraConnection,
  verifyFtpPassword,
} from "@/lib/camera-connection/camera-connection-service.js";
import { getPrisma } from "./prisma.js";

export type CameraFtpAuthContext = {
  userId: number;
  ftpUsername: string;
  assignmentMode: CameraConnectionAssignmentMode;
  activeAlbumId: number | null;
};

/**
 * Autentica credenciales FTP contra CameraConnectionSettings.
 * Nunca loguea la contraseña.
 */
export async function authenticateFtpUser(
  username: string,
  password: string
): Promise<CameraFtpAuthContext> {
  const ftpUsername = username?.trim();
  if (!ftpUsername) {
    throw new GeneralError("Invalid credentials", 530);
  }

  const prisma = getPrisma();
  const settings = await prisma.cameraConnectionSettings.findUnique({
    where: { ftpUsername },
    select: {
      userId: true,
      enabled: true,
      paused: true,
      activeAlbumId: true,
      assignmentMode: true,
      ftpPasswordHash: true,
      ftpUsername: true,
    },
  });

  if (!settings?.ftpUsername) {
    throw new GeneralError("Invalid credentials", 530);
  }

  const passwordOk = await verifyFtpPassword(password, settings.ftpPasswordHash);
  if (!passwordOk) {
    throw new GeneralError("Invalid credentials", 530);
  }

  if (!settings.enabled) {
    throw new GeneralError("Camera connection disabled", 530);
  }

  if (settings.paused) {
    throw new GeneralError("Camera connection paused", 530);
  }

  const assignmentMode =
    settings.assignmentMode ?? CameraConnectionAssignmentMode.MANUAL;

  if (assignmentMode === CameraConnectionAssignmentMode.MANUAL) {
    if (settings.activeAlbumId == null) {
      throw new GeneralError("No active album configured", 530);
    }

    const albumCheck = await validateActiveAlbumForCameraConnection(
      settings.userId,
      settings.activeAlbumId
    );

    if (!albumCheck.ok) {
      throw new FileSystemError(albumCheck.error, 550);
    }
  }

  return {
    userId: settings.userId,
    ftpUsername: settings.ftpUsername,
    assignmentMode,
    activeAlbumId: settings.activeAlbumId,
  };
}
