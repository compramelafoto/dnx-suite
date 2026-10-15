import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";

/** El perfil de fotógrafo de una cuenta, o null si todavía no lo creó. */
export function buscarPerfilPropio(userId: number) {
  return prisma.photographerProfile.findUnique({ where: { userId } });
}

/** Las obras vinculadas a un perfil, con su muestra, para "Mi perfil". */
export function obrasVinculadas(profileId: string) {
  return prisma.culturalActivityWork.findMany({
    where: { authorProfileId: profileId },
    select: { id: true, title: true, imageUrl: true, activity: { select: { title: true, slug: true, reviewStatus: true, type: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

const PUBLICADA = { reviewStatus: "APPROVED", type: "MUESTRA" } as const;

/**
 * Perfiles con al menos una obra en una muestra publicada, para "Fotógrafos que expusieron".
 * `cache`: los metadatos (para el `noindex` de la lista vacía) y la página la piden juntos.
 */
export const listarFotografos = cache(() =>
  prisma.photographerProfile.findMany({
    where: { works: { some: { activity: PUBLICADA } } },
    select: {
      slug: true, displayName: true, city: true, province: true, avatarUrl: true,
      works: { where: { activity: PUBLICADA }, select: { activityId: true } },
    },
    orderBy: { displayName: "asc" },
    take: 1000,
  }),
);

/**
 * Un perfil con sus muestras publicadas y **todas** las obras de cada una: la regla de qué se ve
 * (`profileWorksInActivity`) necesita la muestra completa. `null` si no existe o si todavía no
 * tiene obras en una muestra publicada. `cache`: metadatos y página la piden juntos.
 */
export const buscarPerfilPublico = cache(async (slug: string) => {
  const perfil = await prisma.photographerProfile.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, displayName: true, bio: true, city: true, province: true, website: true, instagram: true, avatarUrl: true,
      // El portfolio es del artista: se ve siempre en su perfil (spec D14).
      portfolio: { orderBy: { sortOrder: "asc" }, select: { id: true, imageUrl: true, title: true, year: true, technique: true, caption: true } },
      // Las imágenes de sus obras expuestas (de cualquier muestra): ninguna se muestra como foto del portfolio (D15).
      works: { select: { imageUrl: true } },
    },
  });
  if (!perfil) return null;
  const muestras = await prisma.culturalActivity.findMany({
    where: { ...PUBLICADA, works: { some: { authorProfileId: perfil.id } } },
    select: {
      id: true, slug: true, title: true, startsAt: true, endsAt: true, galleryMode: true, visibility: true, venueName: true, city: true,
      works: { select: { id: true, title: true, imageUrl: true, isHighlight: true, sortOrder: true, authorProfileId: true } },
    },
    orderBy: { startsAt: "desc" },
    take: 100,
  });
  if (muestras.length === 0) return null;
  return { perfil, muestras };
});
