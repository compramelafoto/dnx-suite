import { prisma } from "@/lib/prisma";
import { verifyFtpPassword } from "@/lib/camera-connection/camera-connection-service";
import { checkAgencyAlbumUpload } from "@/lib/agencies/access";
import { activePresencePoint } from "@/lib/agencies/presence";

export type AgencyFtpLogin = { userId: number; ftpUsername: string; albumId: number; agencyCredentialId: number; memberId: number };

const NO_ACCESS = "Este usuario de FTP ya no puede subir a ese álbum de la agencia.";

/** null = el usuario no es de agencia: el gateway sigue con CameraConnectionSettings como siempre. */
export async function loginAgencyFtp(
  username: string,
  password: string
): Promise<{ ok: true; login: AgencyFtpLogin } | { ok: false; code: 530 | 550; message: string } | null> {
  const ftpUsername = username?.trim();
  if (!ftpUsername) return null;
  const cred = await prisma.agencyUploadCredential.findUnique({
    where: { ftpUsername },
    select: { id: true, memberId: true, albumId: true, ftpUsername: true, ftpPasswordHash: true, revokedAt: true, member: { select: { userId: true } } },
  });
  if (!cred) return null;
  if (cred.revokedAt) return { ok: false, code: 530, message: "Invalid credentials" };
  if (!(await verifyFtpPassword(password, cred.ftpPasswordHash))) return { ok: false, code: 530, message: "Invalid credentials" };
  const access = await checkAgencyAlbumUpload(cred.albumId, cred.member.userId);
  if (!access.agencyAlbum || !access.allowed) {
    return { ok: false, code: 550, message: access.agencyAlbum ? access.error ?? NO_ACCESS : NO_ACCESS };
  }
  return {
    ok: true,
    login: { userId: cred.member.userId, ftpUsername: cred.ftpUsername, albumId: cred.albumId, agencyCredentialId: cred.id, memberId: cred.memberId },
  };
}

export async function resolveAgencyFtpUpload(
  login: AgencyFtpLogin,
  receivedAt: Date
): Promise<{ ok: true; albumId: number; declaredPoint: { lat: number; lng: number } | null } | { ok: false; message: string }> {
  const access = await checkAgencyAlbumUpload(login.albumId, login.userId);
  if (!access.agencyAlbum || !access.allowed) {
    return { ok: false, message: access.agencyAlbum ? access.error ?? NO_ACCESS : NO_ACCESS };
  }
  const presence = await prisma.agencyMemberPresence.findUnique({
    where: { memberId: login.memberId },
    select: { lat: true, lng: true, validUntil: true },
  });
  await prisma.agencyUploadCredential
    .update({ where: { id: login.agencyCredentialId }, data: { lastUsedAt: receivedAt } })
    .catch(() => {});
  return { ok: true, albumId: login.albumId, declaredPoint: activePresencePoint(presence, receivedAt) };
}
