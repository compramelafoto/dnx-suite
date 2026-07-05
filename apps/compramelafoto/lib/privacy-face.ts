import { prisma } from "@/lib/prisma";
import { deleteFace } from "@/lib/faces/rekognition";
import { deleteFromR2 } from "@/lib/r2-client";

/**
 * Elimina todas las plantillas faciales asociadas a un usuario.
 * Busca AlbumInterests por email del usuario (no hay userId en AlbumInterest).
 * Para cada interés con faceId: borra de Rekognition y actualiza DB.
 */
export async function deleteFaceTemplatesForUser(userId: number): Promise<{ deleted: number; errors: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return { deleted: 0, errors: ["Usuario o email no encontrado"] };

  const interests = await prisma.albumInterest.findMany({
    where: {
      email: { equals: user.email, mode: "insensitive" },
      faceId: { not: null },
      biometricDeletedAt: null,
    },
    select: { id: true, faceId: true, selfieKey: true },
  });

  let deleted = 0;
  const errors: string[] = [];
  const now = new Date();

  for (const interest of interests) {
    if (!interest.faceId) continue;
    try {
      const ok = await deleteFace(interest.faceId);
      if (ok) deleted++;
    } catch (e) {
      errors.push(`Rekognition faceId ${interest.faceId}: ${String(e)}`);
      // Continuar: actualizar DB de todas formas para marcar como eliminado
    }
    if (interest.selfieKey) {
      try {
        await deleteFromR2(interest.selfieKey);
      } catch (_e) {
        // Ignorar: el archivo puede no existir
      }
    }
    await prisma.albumInterest.update({
      where: { id: interest.id },
      data: {
        faceId: null,
        selfieKey: null,
        biometricDeletedAt: now,
      },
    });
  }

  return { deleted, errors };
}

export async function logPrivacyEvent(params: {
  eventType: string;
  userId?: number;
  metadata?: Record<string, unknown>;
}) {
  await prisma.privacyEvent.create({
    data: {
      eventType: params.eventType,
      userId: params.userId,
      metadata: (params.metadata ?? undefined) as object | undefined,
    },
  });
}
