import { prisma } from "@/lib/prisma";
import { generateFtpPassword, hashFtpPassword } from "@/lib/camera-connection/camera-connection-service";

/** Usuario de FTP de agencia: "ag" + id del miembro en base 36 (los viejos empiezan con "u"). */
export function agencyFtpUsername(memberId: number): string {
  return `ag${memberId.toString(36)}`;
}

/** Emite un usuario nuevo y revoca los anteriores del miembro. La contraseña sólo se devuelve acá, una vez. */
export async function issueAgencyFtpCredential(input: {
  agencyId: number;
  memberId: number;
  albumId: number;
}): Promise<{ ftpUsername: string; password: string }> {
  const password = generateFtpPassword();
  const ftpPasswordHash = await hashFtpPassword(password);
  return prisma.$transaction(async (tx) => {
    // Serializa emisiones concurrentes del mismo miembro.
    await tx.$queryRaw`SELECT id FROM "AgencyMember" WHERE id = ${input.memberId} FOR UPDATE`;
    await tx.agencyUploadCredential.updateMany({
      where: { memberId: input.memberId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const base = agencyFtpUsername(input.memberId);
    let ftpUsername = base;
    for (let n = 2; await tx.agencyUploadCredential.findUnique({ where: { ftpUsername }, select: { id: true } }); n++) {
      ftpUsername = `${base}-${n}`;
    }
    await tx.agencyUploadCredential.create({
      data: { agencyId: input.agencyId, memberId: input.memberId, albumId: input.albumId, ftpUsername, ftpPasswordHash },
    });
    return { ftpUsername, password };
  });
}

export async function revokeAgencyFtpCredentials(memberId: number): Promise<number> {
  const res = await prisma.agencyUploadCredential.updateMany({
    where: { memberId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}
