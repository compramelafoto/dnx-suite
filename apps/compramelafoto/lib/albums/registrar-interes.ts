import { prisma } from "@/lib/prisma";

export type DatosBiometricosInteres = { selfieKey: string | null; faceId: string | null; consentAt: Date };

/**
 * Crea o actualiza el aviso «avisame cuando haya fotos» (AlbumInterest + AlbumNotification).
 * La usan POST /api/a/[id]/register-interest y DNX Bot.
 *
 * `lastName` y `whatsapp`: `undefined` = no tocar el dato guardado (el bot puede no tenerlo);
 * `null` = guardarlo vacío, como hace hoy el formulario. En `AlbumInterest.update`, `whatsapp`
 * sólo se setea si viene con valor. Los campos biométricos sólo se tocan si `biometrico` no es null.
 */
export async function guardarInteresEnAlbum(p: {
  albumId: number;
  email: string;
  name: string;
  lastName?: string | null;
  whatsapp?: string | null;
  biometrico: DatosBiometricosInteres | null;
  expiresAt: Date;
}): Promise<{ id: number }> {
  const { albumId, email, name, lastName, whatsapp, biometrico, expiresAt } = p;

  const interest = await prisma.albumInterest.upsert({
    where: { albumId_email: { albumId, email } },
    update: {
      name,
      firstName: name,
      ...(lastName !== undefined ? { lastName } : {}),
      ...(whatsapp ? { whatsapp } : {}),
      ...(biometrico
        ? {
            biometricConsent: true,
            biometricConsentAt: biometrico.consentAt,
            biometricDeletedAt: null, // Si había sido eliminado, reactivar
            selfieKey: biometrico.selfieKey,
            faceId: biometrico.faceId,
            expiresAt,
          }
        : {}),
    },
    create: {
      albumId,
      email,
      name,
      firstName: name,
      lastName: lastName ?? null,
      whatsapp: whatsapp ?? null,
      biometricConsent: biometrico ? true : false,
      biometricConsentAt: biometrico ? biometrico.consentAt : null,
      selfieKey: biometrico ? biometrico.selfieKey : null,
      faceId: biometrico ? biometrico.faceId : null,
      expiresAt,
    },
  });

  // También crear AlbumNotification para compatibilidad con el sistema existente
  try {
    await prisma.albumNotification.upsert({
      where: { albumId_email: { albumId, email } },
      update: {
        name,
        ...(lastName !== undefined ? { lastName } : {}),
        ...(whatsapp !== undefined ? { whatsapp } : {}),
      },
      create: {
        albumId,
        email,
        name,
        lastName: lastName ?? null,
        whatsapp: whatsapp ?? null,
        notifiedWhenReady: false,
        notifiedAt3Weeks: false,
        notifiedAt2Weeks: false,
        notifiedAt1Week: false,
      },
    });
  } catch (notifErr) {
    // Si falla por campos desconocidos, continuar (es opcional)
    console.warn("Error creando AlbumNotification:", notifErr);
  }

  return { id: interest.id };
}
