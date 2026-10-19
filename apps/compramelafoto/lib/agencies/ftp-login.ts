import { prisma } from "@/lib/prisma";
import { verifyFtpPassword } from "@/lib/camera-connection/camera-connection-service";
import { checkAgencyUploadTarget } from "@/lib/agencies/upload-target";
import { activePresencePoint } from "@/lib/agencies/presence";
import { agencyAwaitsFilter } from "@/lib/agencies/publish-mode";

export type AgencyFtpLogin = { agencyId: number; userId: number; ftpUsername: string; albumId: number; agencyCredentialId: number; memberId: number };

const NO_ACCESS = "Este usuario de FTP ya no puede subir a ese álbum de la agencia.";

/** El álbum existe, es de ESTA agencia y el miembro puede subirle fotos ahora. */
function checkAccess(agencyId: number, albumId: number, userId: number) {
  return checkAgencyUploadTarget(agencyId, albumId, userId, NO_ACCESS);
}

/** null = el usuario no es de agencia: el gateway sigue con CameraConnectionSettings como siempre. */
export async function loginAgencyFtp(
  username: string,
  password: string
): Promise<{ ok: true; login: AgencyFtpLogin } | { ok: false; code: 530 | 550; message: string } | null> {
  const ftpUsername = username?.trim();
  if (!ftpUsername) return null;
  const cred = await prisma.agencyUploadCredential.findUnique({
    where: { ftpUsername },
    select: { id: true, agencyId: true, memberId: true, albumId: true, ftpUsername: true, ftpPasswordHash: true, revokedAt: true, member: { select: { userId: true } } },
  });
  if (!cred) return null;
  if (cred.revokedAt) return { ok: false, code: 530, message: "Invalid credentials" };
  if (!(await verifyFtpPassword(password, cred.ftpPasswordHash))) return { ok: false, code: 530, message: "Invalid credentials" };
  const access = await checkAccess(cred.agencyId, cred.albumId, cred.member.userId);
  if (!access.ok) return { ok: false, code: 550, message: access.message };
  return {
    ok: true,
    login: { agencyId: cred.agencyId, userId: cred.member.userId, ftpUsername: cred.ftpUsername, albumId: cred.albumId, agencyCredentialId: cred.id, memberId: cred.memberId },
  };
}

export async function resolveAgencyFtpUpload(
  login: AgencyFtpLogin,
  receivedAt: Date
): Promise<{ ok: true; albumId: number; declaredPoint: { lat: number; lng: number } | null; awaitFilter: boolean } | { ok: false; message: string }> {
  // El álbum se lee de la credencial en cada subida: si el fotógrafo lo cambió con la cámara conectada, rige el nuevo.
  const current = await prisma.agencyUploadCredential.findUnique({
    where: { id: login.agencyCredentialId },
    select: { albumId: true, revokedAt: true },
  });
  if (!current || current.revokedAt) return { ok: false, message: "Este usuario de FTP fue desactivado." };
  const access = await checkAccess(login.agencyId, current.albumId, login.userId);
  if (!access.ok) return { ok: false, message: access.message };
  const touched = await prisma.agencyUploadCredential.updateMany({
    where: { id: login.agencyCredentialId, revokedAt: null },
    data: { lastUsedAt: receivedAt },
  });
  if (touched.count === 0) return { ok: false, message: "Este usuario de FTP fue desactivado." };
  const presence = await prisma.agencyMemberPresence.findUnique({
    where: { memberId: login.memberId },
    select: { lat: true, lng: true, validUntil: true },
  });
  const awaitFilter = await agencyAwaitsFilter(login.agencyId);
  return { ok: true, albumId: current.albumId, declaredPoint: activePresencePoint(presence, receivedAt), awaitFilter };
}
