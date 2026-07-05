import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl, urlToR2Key } from "@/lib/r2-client";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { albumIdsWithPublicReadyVideos } from "@/lib/videos/album-media-type-flags";
import {
  countActiveAlbumPhotos,
  buildAlbumListCoverUrls,
} from "@/lib/album/album-list-cover";
import OrganizerPublicLandingPage from "@/components/organizer/OrganizerPublicLandingPage";
import PhotographerPublicPage from "@/components/photographer/PhotographerPublicPage";
import {
  getOrganizerLandingMetadataBySlug,
  getPublishedOrganizerLandingBySlug,
} from "@/lib/organizer-public-landing-server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getPhotographerData(handler: string) {
  const normalizedHandler = handler.toLowerCase();
  
  // Normalizar logoUrl
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
  
  try {
    const photographer = await prisma.user.findFirst({
      where: {
        publicPageHandler: normalizedHandler,
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
        tertiaryColor: true,
        fontColor: true,
        headerBackgroundColor: true,
        footerBackgroundColor: true,
        heroBackgroundColor: true,
        pageBackgroundColor: true,
        preferredLabId: true,
        profitMarginPercent: true,
        enableAlbumsPage: true,
        enablePrintPage: true,
        showCarnetPrints: true,
        showPolaroidPrints: true,
        website: true,
        instagram: true,
        tiktok: true,
        facebook: true,
        whatsapp: true,
        companyAddress: true,
        companyName: true,
      },
    });
    
    if (!photographer) {
      return null;
    }

    photographer.logoUrl = normalizeLogoUrl(photographer.logoUrl);
    
    return photographer;
  } catch (err: any) {
    // Si falla por campos desconocidos, intentar sin ellos
    const errorMsg = String(err?.message ?? "");
    if (errorMsg.includes("enableAlbumsPage") || errorMsg.includes("enablePrintPage") || errorMsg.includes("showCarnetPrints") || errorMsg.includes("showPolaroidPrints") || errorMsg.includes("tertiaryColor") || errorMsg.includes("fontColor") || errorMsg.includes("headerBackgroundColor") || errorMsg.includes("footerBackgroundColor") || errorMsg.includes("heroBackgroundColor") || errorMsg.includes("pageBackgroundColor") || errorMsg.includes("website") || errorMsg.includes("instagram") || errorMsg.includes("tiktok") || errorMsg.includes("facebook") || errorMsg.includes("whatsapp") || errorMsg.includes("companyAddress") || errorMsg.includes("companyName") || errorMsg.includes("Unknown field")) {
      console.warn("GET /[handler]: algunos campos no existen. Ejecutá: npx prisma db push && npx prisma generate");
      try {
        const photographer = await prisma.user.findFirst({
          where: {
            publicPageHandler: normalizedHandler,
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
        
        if (!photographer) {
          return null;
        }

        // Agregar valores por defecto para campos que pueden no existir
        (photographer as any).website = null;
        (photographer as any).instagram = null;
        (photographer as any).tiktok = null;
        (photographer as any).facebook = null;
        (photographer as any).whatsapp = null;
        (photographer as any).companyAddress = null;
        (photographer as any).companyName = null;
        (photographer as any).enableAlbumsPage = true;
        (photographer as any).enablePrintPage = true;
        (photographer as any).showCarnetPrints = false;
        (photographer as any).showPolaroidPrints = false;
        (photographer as any).tertiaryColor = photographer.primaryColor || "#c27b3d";
        (photographer as any).fontColor = null;
        (photographer as any).headerBackgroundColor = null;
        (photographer as any).footerBackgroundColor = null;
        (photographer as any).heroBackgroundColor = null;
        (photographer as any).pageBackgroundColor = null;

        photographer.logoUrl = normalizeLogoUrl(photographer.logoUrl);
        
        return photographer as any;
      } catch (fallbackErr) {
        console.error("Error obteniendo fotógrafo (fallback):", fallbackErr);
        return null;
      }
    } else {
      console.error("Error obteniendo fotógrafo:", err);
      return null;
    }
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handler: string }>;
}): Promise<Metadata> {
  const { handler } = await Promise.resolve(params);
  
  if (!handler || typeof handler !== "string") {
    return {
      title: "ComprameLaFoto",
      description: "Plataforma para comprar y descargar fotografías digitales e impresas",
    };
  }

  const organizerMeta = await getOrganizerLandingMetadataBySlug(handler);
  if (organizerMeta) {
    const iconUrl = organizerMeta.logoUrl || organizerMeta.ogImage;
    return {
      title: `${organizerMeta.title} - ComprameLaFoto`,
      description: organizerMeta.description,
      openGraph: {
        title: `${organizerMeta.title} - ComprameLaFoto`,
        description: organizerMeta.description,
        url: organizerMeta.canonical,
        images: [{ url: organizerMeta.ogImage, alt: organizerMeta.title }],
        type: "website",
        locale: "es_AR",
      },
      twitter: {
        card: "summary_large_image",
        title: `${organizerMeta.title} - ComprameLaFoto`,
        description: organizerMeta.description,
        images: [organizerMeta.ogImage],
      },
      icons: iconUrl
        ? {
            icon: [{ url: iconUrl, type: "image/png" }],
            shortcut: iconUrl,
            apple: iconUrl,
          }
        : undefined,
    };
  }

  const photographer = await getPhotographerData(handler);
  
  if (!photographer) {
    return {
      title: "ComprameLaFoto",
      description: "Plataforma para comprar y descargar fotografías digitales e impresas",
    };
  }

  const photographerName = photographer.name || photographer.companyName || "Fotógrafo";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : "https://compramelafoto.com";
  const ogImage = photographer.logoUrl || `${siteUrl}/watermark.png`;
  
  // Asegurar que la URL de la imagen sea absoluta
  const ogImageUrl = ogImage && ogImage.startsWith("http") 
    ? ogImage 
    : `${siteUrl}${ogImage && ogImage.startsWith("/") ? "" : "/"}${ogImage || "/watermark.png"}`;

  return {
    title: `${photographerName} - ComprameLaFoto`,
    description: `Comprá y descargá fotos digitales e impresas de ${photographerName}. Plataforma segura para comprar fotografías.`,
    openGraph: {
      title: `${photographerName} - ComprameLaFoto`,
      description: `Comprá y descargá fotos digitales e impresas de ${photographerName}. Plataforma segura para comprar fotografías.`,
      images: [{ url: ogImageUrl }],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${photographerName} - ComprameLaFoto`,
      description: `Comprá y descargá fotos digitales e impresas de ${photographerName}. Plataforma segura para comprar fotografías.`,
      images: [ogImageUrl],
    },
    icons: {
      icon: photographer.logoUrl ? [{ url: ogImageUrl, sizes: "32x32", type: "image/png" }] : [{ url: "/watermark.png", sizes: "32x32", type: "image/png" }],
      shortcut: photographer.logoUrl ? ogImageUrl : "/watermark.png",
      apple: photographer.logoUrl ? ogImageUrl : "/watermark.png",
    },
  };
}

export default async function PhotographerHandlerPage({
  params,
  searchParams,
}: {
  params: Promise<{ handler: string }>;
  searchParams?: Promise<{ embed?: string }>;
}) {
  const { handler } = await Promise.resolve(params);
  const resolvedSearchParams: { embed?: string } = searchParams ? await searchParams : {};
  const hideLogo = resolvedSearchParams.embed === "1";

  if (!handler || typeof handler !== "string") {
    notFound();
  }

  const organizerLanding = await getPublishedOrganizerLandingBySlug(handler);
  if (organizerLanding) {
    return <OrganizerPublicLandingPage landing={organizerLanding} />;
  }

  const photographer = await getPhotographerData(handler);

  if (!photographer) {
    notFound();
  }

  // Aplicar valores por defecto si es necesario
  if (photographer.enableAlbumsPage === null || photographer.enableAlbumsPage === undefined) {
    photographer.enableAlbumsPage = true;
  }
  if (photographer.enablePrintPage === null || photographer.enablePrintPage === undefined) {
    photographer.enablePrintPage = true;
  }
  if (photographer.showCarnetPrints === null || photographer.showCarnetPrints === undefined) {
    photographer.showCarnetPrints = false;
  }
  if (photographer.showPolaroidPrints === null || photographer.showPolaroidPrints === undefined) {
    photographer.showPolaroidPrints = false;
  }
  if (!photographer.tertiaryColor) {
    photographer.tertiaryColor = photographer.primaryColor || "#c27b3d";
  }

  // Obtener todos los álbumes del fotógrafo (donde es owner o colaborador)
  let allAlbums: any[] = [];
  
  try {
    // Álbumes donde es owner (solo públicos)
    const ownedAlbums = await prisma.album.findMany({
      where: {
        userId: photographer.id,
        isHidden: false,
        isPublic: true,
      },
      include: {
        photos: {
          where: { isRemoved: false },
          select: { id: true, userId: true, previewUrl: true, originalKey: true, isRemoved: true },
          orderBy: { createdAt: "asc" },
        },
        coverPhoto: { select: { id: true, originalKey: true, previewUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Álbumes donde es colaborador (tiene fotos subidas pero no es owner, solo públicos)
    const collaboratedAlbums = await prisma.album.findMany({
      where: {
        userId: { not: photographer.id },
        isHidden: false,
        isPublic: true,
        photos: {
          some: {
            userId: photographer.id,
          },
        },
      },
      include: {
        photos: {
          where: { isRemoved: false },
          select: { id: true, userId: true, previewUrl: true, originalKey: true, isRemoved: true },
          orderBy: { createdAt: "asc" },
        },
        coverPhoto: { select: { id: true, originalKey: true, previewUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const ownedVisible = ownedAlbums.filter((album) => isAlbumPubliclyAccessible(album));
    const collaboratedVisible = collaboratedAlbums.filter((album) => isAlbumPubliclyAccessible(album));

    // Combinar y procesar álbumes
    allAlbums = [...ownedVisible, ...collaboratedVisible].map((album) => {
      const photosCount = countActiveAlbumPhotos(album.photos);
      const cover = buildAlbumListCoverUrls({
        id: album.id,
        coverPhotoId: album.coverPhotoId ?? null,
        coverThumbnailKey: album.coverThumbnailKey,
        coverPhoto: album.coverPhoto,
        photos: album.photos,
      });
      return {
        id: album.id,
        title: album.title,
        location: album.location,
        eventDate: album.eventDate,
        publicSlug: album.publicSlug,
        createdAt: album.createdAt,
        photosCount,
        coverPhotoUrl: cover.coverPhotoUrl,
        coverPhotoUrlFallback: cover.coverPhotoUrlFallback ?? undefined,
        showComingSoonMessage: photosCount <= 0,
      };
    });
    
    const albumIds = allAlbums.map((a) => a.id);
    const withPublicVideos = await albumIdsWithPublicReadyVideos(prisma, albumIds);
    allAlbums = allAlbums.map((album) => ({
      ...album,
      hasPhotos: album.photosCount > 0,
      hasVideos: withPublicVideos.has(album.id),
    }));

    console.log(`GET /[handler]: Se encontraron ${allAlbums.length} álbumes (${ownedVisible.length} propios, ${collaboratedVisible.length} colaborados)`);
  } catch (err: any) {
    // Si falla, intentar query más simple sin coverPhoto
    const errorMsg = String(err?.message ?? "");
    if (errorMsg.includes("coverPhoto") || errorMsg.includes("Unknown field")) {
      try {
        const ownedAlbums = await prisma.album.findMany({
          where: {
            userId: photographer.id,
            isHidden: false,
          },
          include: {
            photos: { select: { id: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const collaboratedAlbums = await prisma.album.findMany({
          where: {
            userId: { not: photographer.id },
            isHidden: false,
            photos: {
              some: {
                userId: photographer.id,
              },
            },
          },
          include: {
            photos: { select: { id: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const ownedVisible = ownedAlbums.filter((album) => isAlbumPubliclyAccessible(album));
        const collaboratedVisible = collaboratedAlbums.filter((album) => isAlbumPubliclyAccessible(album));
        allAlbums = [...ownedVisible, ...collaboratedVisible].map((album: any) => ({
          id: album.id,
          title: album.title,
          location: album.location,
          eventDate: album.eventDate,
          publicSlug: album.publicSlug,
          createdAt: album.createdAt,
          photosCount: album.photos.length,
          coverPhotoUrl: null,
          showComingSoonMessage: album.showComingSoonMessage || false,
        }));
      } catch (fallbackErr) {
        console.error("Error obteniendo álbumes:", fallbackErr);
        allAlbums = [];
      }
    } else {
      console.error("Error obteniendo álbumes:", err);
      allAlbums = [];
    }
  }

  // Log final para debugging
  console.log(`GET /[handler]: Renderizando página con enableAlbumsPage=${photographer.enableAlbumsPage}, enablePrintPage=${photographer.enablePrintPage}, albums=${allAlbums.length}`);

  return (
    <PhotographerPublicPage
      photographer={photographer}
      handler={handler}
      albums={allAlbums}
      hideLogo={hideLogo}
    />
  );
}
