// app/a/[id]/page.tsx — Vista cliente: solo selección y compra, con protección anti-captura
import type { Metadata } from "next";
import { prisma, Prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { notFound, permanentRedirect } from "next/navigation";
import { getR2PublicUrl, urlToR2Key } from "@/lib/r2-client";
import ProtectedAlbumWrapper from "@/components/photo/ProtectedAlbumWrapper";
import ClientAlbumView from "@/components/photo/ClientAlbumView";
import PhotographerHeader from "@/components/photographer/PhotographerHeader";
import PhotographerFooter from "@/components/photographer/PhotographerFooter";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { getAuthUser } from "@/lib/auth";

function normalizeLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    if (!logoUrl.includes("localhost") && !logoUrl.includes("127.0.0.1")) return logoUrl;
    return getR2PublicUrl(urlToR2Key(logoUrl));
  }
  return getR2PublicUrl(logoUrl.replace(/^\//, ""));
}

export async function generateMetadata({
  params,
}: {
  params: { id?: string } | Promise<{ id?: string }>;
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params);
  const slugOrId = String(resolved?.id || "").trim();
  if (!slugOrId) return {};
  let album: { title: string; user: { name: string | null; logoUrl: string | null } | null } | null = null;
  try {
    album = await prisma.album.findUnique({
      where: { publicSlug: slugOrId },
      select: { title: true, user: { select: { name: true, logoUrl: true } } },
    });
  } catch {
    // ignore
  }
  if (!album && /^\d+$/.test(slugOrId)) {
    try {
      album = await prisma.album.findUnique({
        where: { id: parseInt(slugOrId, 10) },
        select: { title: true, user: { select: { name: true, logoUrl: true } } },
      });
    } catch {
      // ignore
    }
  }
  if (!album) return {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");
  const logoUrl = normalizeLogoUrl(album.user?.logoUrl ?? null);
  const ogImage = logoUrl ? (logoUrl.startsWith("http") ? logoUrl : `${siteUrl}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`) : `${siteUrl}/watermark.png`;
  const title = album.title || "Álbum";
  const name = album.user?.name || "Fotógrafo";
  return {
    title: `${title} - ${name} | ComprameLaFoto`,
    description: `Ver y comprar fotos del álbum ${title} por ${name}.`,
    openGraph: {
      title: `${title} - ${name} | ComprameLaFoto`,
      description: `Ver y comprar fotos del álbum ${title}.`,
      images: [{ url: ogImage }],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${title} - ${name} | ComprameLaFoto`,
      description: `Ver y comprar fotos del álbum ${title}.`,
      images: [ogImage],
    },
  };
}

export default async function Page({ params }: { params: { id?: string } | Promise<{ id?: string }> }) {
  const resolved = await Promise.resolve(params);
  const slugOrId = String(resolved?.id || "");
  
  if (!slugOrId) return notFound();

  let album: any;
  let photographer: any = null;

  const selectAlbumBase = {
    id: true,
    userId: true,
    title: true,
    location: true,
    eventDate: true,
    publicSlug: true,
    createdAt: true,
    deletedAt: true,
    firstPhotoDate: true,
    isHidden: true,
    isPublic: true,
    enablePrintedPhotos: true,
    enableDigitalPhotos: true,
    selectedLabId: true,
    albumProfitMarginPercent: true,
    pickupBy: true,
    digitalPhotoPriceCents: true,
    termsAcceptedAt: true,
    termsVersion: true,
    showComingSoonMessage: true,
    hiddenPhotosEnabled: true,
    photos: {
      where: {
        isRemoved: false,
      },
      select: {
        id: true,
        previewUrl: true,
        originalKey: true,
        createdAt: true,
        analysisStatus: true,
      },
      orderBy: { createdAt: Prisma.SortOrder.asc },
    },
    user: {
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        tertiaryColor: true,
        publicPageHandler: true,
        isPublicPageEnabled: true,
      },
    },
  } as Prisma.AlbumSelect;

  const selectAlbumWithRemoved = {
    ...selectAlbumBase,
    photos: {
      select: {
        id: true,
        previewUrl: true,
        originalKey: true,
        createdAt: true,
        isRemoved: true,
        analysisStatus: true,
      },
      orderBy: { createdAt: Prisma.SortOrder.asc },
    },
  } as Prisma.AlbumSelect;

  const selectAlbumBaseWithExtension = {
    ...selectAlbumBase,
    expirationExtensionDays: true,
  } as Prisma.AlbumSelect;

  const selectAlbumWithRemovedWithExtension = {
    ...selectAlbumWithRemoved,
    expirationExtensionDays: true,
  } as Prisma.AlbumSelect;

  const selectForExtensionFallback = (err: any) => {
    const msg = String(err?.message ?? "");
    return msg.includes("expirationExtensionDays") || msg.includes("Unknown field");
  };

  const findAlbumByTitleGuess = async (slug: string) => {
    const base = slug.replace(/-[a-f0-9]{8}$/i, "").replace(/-+/g, " ").trim();
    if (!base) return null;
    try {
      return await prisma.album.findFirst({
        where: {
          title: { contains: base, mode: "insensitive" },
        },
        select: selectAlbumBaseWithExtension,
      });
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (selectForExtensionFallback(err)) {
        return await prisma.album.findFirst({
          where: {
            title: { contains: base, mode: "insensitive" },
          },
          select: selectAlbumBase,
        });
      }
      if (msg.includes("Unknown arg") && msg.includes("mode")) {
        return await prisma.album.findFirst({
          where: {
            title: { contains: base },
          },
          select: selectAlbumBase,
        });
      }
      throw err;
    }
  };

  const findAlbumBySlug = async (where: any) => {
    try {
      return await prisma.album.findFirst({
        where,
        select: selectAlbumBaseWithExtension,
      });
    } catch (slugErr: any) {
      const msg = String(slugErr?.message ?? "");
      if (msg.includes("publicSlug") || msg.includes("Unknown field") || msg.includes("Unknown column")) {
        return null;
      }
      if (selectForExtensionFallback(slugErr)) {
        return await prisma.album.findFirst({
          where,
          select: selectAlbumBase,
        });
      }
      if (slugErr?.message?.includes("isRemoved")) {
        const result = await prisma.album.findFirst({
          where,
          select: selectAlbumWithRemovedWithExtension,
        });
        if (result && result.photos) {
          result.photos = result.photos.filter((p: any) => !p.isRemoved);
        }
        return result;
      }
      throw slugErr;
    }
  };
  
  try {
    // Intentar buscar por publicSlug primero (es un string único)
    try {
      album = await prisma.album.findUnique({
        where: { publicSlug: slugOrId },
        select: selectAlbumBaseWithExtension,
      });
    } catch (slugErr: any) {
      const msg = String(slugErr?.message ?? "");
      if (msg.includes("publicSlug") || msg.includes("Unknown field") || msg.includes("Unknown column")) {
        album = await findAlbumByTitleGuess(slugOrId);
      } else if (selectForExtensionFallback(slugErr)) {
        album = await prisma.album.findUnique({
          where: { publicSlug: slugOrId },
          select: selectAlbumBase,
        });
      } else
      // Si falla por isRemoved, cargar todas las fotos y filtrar manualmente
      if (slugErr?.message?.includes("isRemoved")) {
        album = await prisma.album.findUnique({
          where: { publicSlug: slugOrId },
          select: selectAlbumWithRemovedWithExtension,
        });
        if (album && album.photos) {
          // Filtrar manualmente las fotos removidas
          album.photos = album.photos.filter((p: any) => !p.isRemoved);
        }
      } else {
        throw slugErr;
      }
    }
    
    // Si no se encontró por publicSlug, intentar alias de slug (redirección 301)
    if (!album) {
      try {
        const alias = await prisma.albumSlugAlias.findUnique({
          where: { aliasSlug: slugOrId },
          include: { targetAlbum: { select: { publicSlug: true } } },
        });
        if (alias?.targetAlbum?.publicSlug) {
          permanentRedirect(`/a/${alias.targetAlbum.publicSlug}`);
        }
      } catch {
        // Ignorar si la tabla no existe aún (migración pendiente)
      }
    }

    // Si no se encontró por publicSlug ni alias, intentar variantes comunes
    if (!album) {
      const normalizedSlug = slugOrId.replace(/-+/g, "-");
      const slugCandidates = Array.from(
        new Set([slugOrId, slugOrId.toLowerCase(), normalizedSlug])
      );

      for (const candidate of slugCandidates) {
        if (!candidate) continue;
        album = await findAlbumBySlug({
          publicSlug: { equals: candidate, mode: "insensitive" },
        });
        if (album) break;
      }

      if (!album) {
        const suffix = slugOrId.split("-").pop() || "";
        if (/^[a-f0-9]{8}$/i.test(suffix)) {
          album = await findAlbumBySlug({
            publicSlug: { endsWith: `-${suffix}`, mode: "insensitive" },
          });
        }
      }

      if (!album) {
        album = await findAlbumByTitleGuess(slugOrId);
      }
    }

    // Si no se encontró por publicSlug, intentar por ID numérico (para compatibilidad con links antiguos)
    if (!album) {
      const albumId = Number.parseInt(slugOrId, 10);
      if (Number.isFinite(albumId)) {
        try {
          album = await prisma.album.findUnique({
            where: { id: albumId },
            select: selectAlbumBaseWithExtension,
          });
        } catch (idErr: any) {
          const errorMsg = String(idErr?.message ?? "");
          // Si falla por campo desconocido, intentar sin firstPhotoDate o sin isRemoved
          if (errorMsg.includes("firstPhotoDate") || errorMsg.includes("isRemoved") || errorMsg.includes("Unknown field")) {
            try {
              album = await prisma.album.findUnique({
                where: { id: albumId },
                select: {
                  id: true,
                  userId: true,
                  title: true,
                  location: true,
                  eventDate: true,
                  createdAt: true,
                  isHidden: true,
                  showComingSoonMessage: true,
                  photos: {
                    where: {
                      isRemoved: false, // Excluir fotos removidas
                    },
                    select: {
                      id: true,
                      previewUrl: true,
                      originalKey: true,
                      createdAt: true,
                    },
                    orderBy: { createdAt: "asc" },
                  },
                  user: {
                    select: {
                      id: true,
                      name: true,
                      logoUrl: true,
                      primaryColor: true,
                      secondaryColor: true,
                      tertiaryColor: true,
                      publicPageHandler: true,
                      isPublicPageEnabled: true,
                    },
                  },
                },
              });
              if (album) {
                album.firstPhotoDate = null;
              }
            } catch (fallbackErr: any) {
              // Si aún falla por isRemoved, cargar todas las fotos y filtrar manualmente
              if (fallbackErr?.message?.includes("isRemoved")) {
                album = await prisma.album.findUnique({
                  where: { id: albumId },
                  select: {
                    id: true,
                    userId: true,
                    title: true,
                    location: true,
                    eventDate: true,
                    createdAt: true,
                    isHidden: true,
                    showComingSoonMessage: true,
                    photos: {
                      select: {
                        id: true,
                        previewUrl: true,
                        originalKey: true,
                        createdAt: true,
                        isRemoved: true,
                      },
                      orderBy: { createdAt: "asc" },
                    },
                    user: {
                      select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        primaryColor: true,
                        secondaryColor: true,
                        tertiaryColor: true,
                        publicPageHandler: true,
                        isPublicPageEnabled: true,
                      },
                    },
                  },
                });
                if (album && album.photos) {
                  // Filtrar manualmente las fotos removidas
                  album.photos = album.photos.filter((p: any) => !p.isRemoved);
                  album.firstPhotoDate = null;
                }
              } else if (selectForExtensionFallback(fallbackErr)) {
                album = await prisma.album.findUnique({
                  where: { id: albumId },
                  select: selectAlbumBase,
                });
              } else {
                throw fallbackErr;
              }
            }
          } else {
            throw idErr;
          }
        }
      }
    }
  } catch (err: any) {
    // Si hay un error en la búsqueda por publicSlug, intentar por ID numérico
    const albumId = Number.parseInt(slugOrId, 10);
    if (Number.isFinite(albumId)) {
      try {
        album = await prisma.album.findUnique({
          where: { id: albumId },
          select: selectAlbumBaseWithExtension,
        });
      } catch (idErr: any) {
        const errorMsg = String(idErr?.message ?? "");
        // Si falla por campo desconocido, intentar sin firstPhotoDate o sin isRemoved
        if (errorMsg.includes("firstPhotoDate") || errorMsg.includes("isRemoved") || errorMsg.includes("Unknown field")) {
          try {
            album = await prisma.album.findUnique({
              where: { id: albumId },
              select: {
                id: true,
                userId: true,
                title: true,
                location: true,
                eventDate: true,
                createdAt: true,
                isHidden: true,
                showComingSoonMessage: true,
                photos: {
                  where: {
                    isRemoved: false, // Excluir fotos removidas
                  },
                  select: {
                    id: true,
                    previewUrl: true,
                    originalKey: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: "asc" },
                },
                user: {
                  select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    primaryColor: true,
                    secondaryColor: true,
                    publicPageHandler: true,
                    isPublicPageEnabled: true,
                  },
                },
              },
            });
            if (album) {
              album.firstPhotoDate = null;
            }
          } catch (fallbackErr: any) {
            // Si aún falla por isRemoved, cargar todas las fotos y filtrar manualmente
            if (fallbackErr?.message?.includes("isRemoved")) {
              album = await prisma.album.findUnique({
                where: { id: albumId },
                select: {
                  id: true,
                  userId: true,
                  title: true,
                  location: true,
                  eventDate: true,
                  createdAt: true,
                  isHidden: true,
                  showComingSoonMessage: true,
                  photos: {
                    select: {
                      id: true,
                      previewUrl: true,
                      originalKey: true,
                      createdAt: true,
                      isRemoved: true,
                    },
                    orderBy: { createdAt: "asc" },
                  },
                  user: {
                    select: {
                      id: true,
                      name: true,
                      logoUrl: true,
                      primaryColor: true,
                      secondaryColor: true,
                      publicPageHandler: true,
                      isPublicPageEnabled: true,
                    },
                  },
                },
              });
              if (album && album.photos) {
                // Filtrar manualmente las fotos removidas
                album.photos = album.photos.filter((p: any) => !p.isRemoved);
                album.firstPhotoDate = null;
              }
            } else if (selectForExtensionFallback(fallbackErr)) {
              album = await prisma.album.findUnique({
                where: { id: albumId },
                select: selectAlbumBase,
              });
            } else {
              throw fallbackErr;
            }
          }
        } else {
          throw idErr;
        }
      }
    }
  }

  if (!album) return notFound();
  const deletedCheck = await prisma.album.findUnique({
    where: { id: album.id },
    select: { deletedAt: true },
  });
  if (deletedCheck?.deletedAt) return notFound();

  const authUser = await getAuthUser();
  const isOwner = authUser?.id === album.userId;
  const isAdmin = authUser?.role === Role.ADMIN;
  const hasAccess = authUser
    ? await prisma.albumAccess.findUnique({
        where: { albumId_userId: { albumId: album.id, userId: authUser.id } },
      })
    : null;
  const canAccess = isAlbumPubliclyAccessible(album) || isOwner || Boolean(hasAccess) || isAdmin;

  if (!canAccess) {
    return (
      <section className="py-16 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center w-full px-4 sm:px-6">
          <div className="mx-auto flex flex-col items-center space-y-6 max-w-6xl">
          <img
            src="/watermark.png"
            alt="ComprameLaFoto"
            className="w-28 mx-auto opacity-70"
          />
          <h2 className="text-2xl font-semibold text-[#1a1a1a]">
            No tenés autorización
          </h2>
            <p className="text-base text-[#6b7280] leading-relaxed">
              Este álbum no está disponible públicamente. Si te invitaron al evento,
              pedile al organizador o fotógrafo que te autorice el acceso.
            </p>
            <p className="text-xs text-[#9ca3af]">
              ID del álbum: {album.publicSlug || album.id}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Obtener información del fotógrafo si tiene página pública habilitada
  if (album.user && album.user.isPublicPageEnabled && album.user.publicPageHandler) {
    photographer = {
      id: album.user.id,
      name: album.user.name,
      logoUrl: album.user.logoUrl,
      secondaryColor: album.user.secondaryColor,
      tertiaryColor: album.user.tertiaryColor,
      publicPageHandler: album.user.publicPageHandler,
    };
  }

  // Calcular firstPhotoDate: usar el campo del álbum si existe, sino usar la fecha de la primera foto
  let firstPhotoDate: string | null = null;
  if (album.firstPhotoDate) {
    firstPhotoDate = album.firstPhotoDate.toISOString();
  } else if (album.photos.length > 0 && album.photos[0]?.createdAt) {
    firstPhotoDate = album.photos[0].createdAt.toISOString();
  }

  const hasPhotos = album.photos.length > 0;
  const baseDate = firstPhotoDate ? new Date(firstPhotoDate) : null;
  const extensionDays = (album as any).expirationExtensionDays ?? 0;
  const visibleUntil = baseDate
    ? new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000)
    : null;
  const isExpired = visibleUntil ? new Date() >= visibleUntil : false;
  const isAccessBlocked = !isAdmin && Boolean(album.isHidden || isExpired);

  const mappedPhotos: Array<{ id: number; previewUrl: string; originalKey: string }> = album.photos.map((p: any) => {
    const previewUrl = `/api/photos/${p.id}/view?albumId=${album.id}&mode=preview`;
    return {
      id: p.id,
      previewUrl,
      originalKey: p.originalKey,
    };
  });
  const signedPhotos = mappedPhotos.filter((p: { previewUrl: string }) => Boolean(p.previewUrl));

  return (
    <>
      {photographer ? (
        <PhotographerHeader photographer={photographer} handler={photographer.publicPageHandler} />
      ) : null}
      <ProtectedAlbumWrapper enableProtection={hasPhotos && !isAccessBlocked} albumId={album.id}>
        <ClientAlbumView
          album={{
            id: album.id,
            title: album.title,
            location: album.location,
            eventDate: album.eventDate ? album.eventDate.toISOString() : null,
            createdAt: album.createdAt.toISOString(),
            firstPhotoDate,
            expirationExtensionDays: (album as any).expirationExtensionDays ?? 0,
            showComingSoonMessage: album.showComingSoonMessage,
            hiddenPhotosEnabled: Boolean((album as any).hiddenPhotosEnabled),
            photos: signedPhotos.filter((p) => p.previewUrl), // Filtrar fotos sin previewUrl válida
          }}
          tertiaryColor={photographer?.tertiaryColor}
          isAccessBlocked={isAccessBlocked}
          initialHasGrant={isOwner || isAdmin}
        />
      </ProtectedAlbumWrapper>
      {photographer ? (
        <PhotographerFooter photographer={photographer} />
      ) : null}
    </>
  );
}
