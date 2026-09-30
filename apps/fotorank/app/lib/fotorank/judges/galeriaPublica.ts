import { prisma } from "@repo/db";

import { judgeAvatarSrc } from "./judgeAvatarSrc";

/**
 * Los jurados que se muestran en la galería pública, `/jurados/galeria`.
 *
 * Mismo criterio que el perfil público: ficha aprobada por FotoRank, perfil
 * público y cuenta activa. La ubicación sólo sale si el jurado la dejó visible.
 */
export type JuradoDeLaGaleria = {
  slug: string;
  nombre: string;
  titular: string | null;
  foto: string | null;
  lugar: string | null;
};

export async function juradosDeLaGaleria(): Promise<JuradoDeLaGaleria[]> {
  const perfiles = await prisma.fotorankJudgeProfile.findMany({
    where: {
      isPublic: true,
      directoryReviewStatus: "APPROVED",
      judgeAccount: { accountStatus: "ACTIVE" },
    },
    select: {
      id: true,
      publicSlug: true,
      firstName: true,
      lastName: true,
      displayNameOverride: true,
      professionalHeadline: true,
      avatarUrl: true,
      city: true,
      country: true,
      showLocationPublicly: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return perfiles
    .map((p) => ({
      slug: p.publicSlug,
      nombre: p.displayNameOverride?.trim() || `${p.firstName} ${p.lastName}`.trim(),
      titular: p.professionalHeadline?.trim() || null,
      foto: judgeAvatarSrc({ id: p.id, avatarUrl: p.avatarUrl }),
      lugar: p.showLocationPublicly
        ? [p.city, p.country].filter(Boolean).join(", ") || null
        : null,
    }))
    // Con foto primero: una grilla que abre con tarjetas vacías no convoca a nadie.
    .sort((a, b) => Number(Boolean(b.foto)) - Number(Boolean(a.foto)));
}
