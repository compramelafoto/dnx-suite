import { CameraConnectionAssignmentMode } from "@repo/db";
import { FileSystemError, GeneralError } from "./ftp-srv-compat.js";
import {
  validateActiveAlbumForCameraConnection,
  verifyFtpPassword,
} from "@/lib/camera-connection/camera-connection-service.js";
import {
  loginAgencyFtp,
  type AgencyFtpLogin,
} from "@/lib/agencies/ftp-login.js";
import { getPrisma } from "./prisma.js";

export type CameraFtpAuthContext = {
  userId: number;
  ftpUsername: string;
  assignmentMode: CameraConnectionAssignmentMode;
  activeAlbumId: number | null;
  /** Presente cuando el login es de un usuario FTP de agencia. */
  agency?: AgencyFtpLogin;
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
    const agencyLogin = await loginAgencyFtp(ftpUsername, password);
    if (agencyLogin === null) {
      throw new GeneralError("Invalid credentials", 530);
    }
    if (!agencyLogin.ok) {
      throw agencyLogin.code === 530
        ? new GeneralError(agencyLogin.message, 530)
        : new FileSystemError(agencyLogin.message, 550);
    }
    const { login } = agencyLogin;
    return {
      userId: login.userId,
      ftpUsername: login.ftpUsername,
      assignmentMode: CameraConnectionAssignmentMode.MANUAL,
      activeAlbumId: login.albumId,
      agency: login,
    };
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
