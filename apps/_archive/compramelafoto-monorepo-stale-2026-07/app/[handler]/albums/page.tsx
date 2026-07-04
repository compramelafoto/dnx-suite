import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl, urlToR2Key, normalizePreviewUrl } from "@/lib/r2-client";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import PhotographerAlbumsPage from "@/components/photographer/PhotographerAlbumsPage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PhotographerAlbumsHandlerPage({
  params,
}: {
  params: { handler: string } | Promise<{ handler: string }>;
}) {
  const { handler } = await Promise.resolve(params);

  if (!handler || typeof handler !== "string") {
    notFound();
  }

  // Buscar fotógrafo por handler
  let photographer: any;
  
  try {
    // Intentar con enableAlbumsPage primero
    photographer = await prisma.user.findFirst({
      where: {
        publicPageHandler: handler.toLowerCase(),
        isPublicPageEnabled: true,
        enableAlbumsPage: true,
        role: "PHOTOGRAPHER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        preferredLabId: true,
        profitMarginPercent: true,
      },
    });
  } catch (err: any) {
    // Si falla por campo desconocido, intentar sin enableAlbumsPage
    const errorMsg = String(err?.message ?? "");
    if (errorMsg.includes("enableAlbumsPage") || errorMsg.includes("Unknown field")) {
      photographer = await prisma.user.findFirst({
        where: {
          publicPageHandler: handler.toLowerCase(),
          isPublicPageEnabled: true,
          role: "PHOTOGRAPHER",
        },
        select: {
          id: true,
          name: true,
          email: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          preferredLabId: true,
          profitMarginPercent: true,
        },
      });
    } else {
      throw err;
    }
  }

  if (!photographer) {
    notFound();
  }

  const normalizeLogoUrl = (logoUrl: string | null | undefined): string | null => {
    if (!logoUrl) return null;
    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
      if (!logoUrl.includes("localhost") && !logoUrl.includes("127.0.0.1")) {
        return logoUrl;
      }
      return getR2PublicUrl(urlToR2Key(logoUrl));
    }
    const key = logoUrl.replace(/^\//, "");
    return getR2PublicUrl(key);
  };

  photographer.logoUrl = normalizeLogoUrl(photographer.logoUrl);

  // Obtener álbumes públicos del fotógrafo (no ocultos, solo públicos)
  const albums = await prisma.album.findMany({
    where: {
      userId: photographer.id,
      isHidden: false,
      isPublic: true,
    },
    include: {
      photos: { select: { id: true } },
      coverPhoto: { select: { id: true, originalKey: true, previewUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const albumsWithData = albums
    .filter((album) => isAlbumPubliclyAccessible(album))
    .map((album) => ({
    id: album.id,
    title: album.title,
    location: album.location,
    eventDate: album.eventDate,
    publicSlug: album.publicSlug,
    createdAt: album.createdAt,
    photosCount: album.photos.length,
    coverPhotoUrl: album.coverThumbnailKey
      ? getR2PublicUrl(album.coverThumbnailKey)
      : album.coverPhoto
        ? (normalizePreviewUrl(album.coverPhoto.previewUrl, album.coverPhoto.originalKey) ?? (album.coverPhoto.originalKey ? getR2PublicUrl(album.coverPhoto.originalKey) : null))
        : null,
    showComingSoonMessage: album.showComingSoonMessage || false,
  }));

  return (
    <PhotographerAlbumsPage
      photographer={photographer}
      handler={handler}
      albums={albumsWithData}
    />
  );
}
