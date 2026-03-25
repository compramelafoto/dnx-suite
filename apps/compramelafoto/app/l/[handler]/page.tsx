import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl, urlToR2Key, normalizePreviewUrl } from "@/lib/r2-client";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LabPublicFooter from "@/components/lab/LabPublicFooter";
import LabPublicShare from "@/components/lab/LabPublicShare";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeLabLogoUrl(logoUrl: string | null | undefined): string | null {
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
  params: { handler: string } | Promise<{ handler: string }>;
}): Promise<Metadata> {
  const { handler } = await Promise.resolve(params);
  if (!handler || typeof handler !== "string") return {};
  const lab = await prisma.lab.findFirst({
    where: {
      publicPageHandler: handler.toLowerCase(),
      isPublicPageEnabled: true,
      isActive: true,
    },
    select: { name: true, logoUrl: true },
  });
  if (!lab) return {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");
  const logoUrl = normalizeLabLogoUrl(lab.logoUrl);
  const ogImage = logoUrl ? (logoUrl.startsWith("http") ? logoUrl : `${siteUrl}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`) : `${siteUrl}/watermark.png`;
  return {
    title: `${lab.name} - ComprameLaFoto`,
    description: `Impresión de fotos y servicios de ${lab.name}. ComprameLaFoto.`,
    openGraph: {
      title: `${lab.name} - ComprameLaFoto`,
      description: `Impresión de fotos y servicios de ${lab.name}.`,
      images: [{ url: ogImage }],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${lab.name} - ComprameLaFoto`,
      description: `Impresión de fotos y servicios de ${lab.name}.`,
      images: [ogImage],
    },
  };
}

export default async function LabPublicPage({
  params,
}: {
  params: { handler: string } | Promise<{ handler: string }>;
}) {
  const { handler } = await Promise.resolve(params);

  if (!handler || typeof handler !== "string") {
    notFound();
  }

  const whereClause: any = {
    publicPageHandler: handler.toLowerCase(),
    isPublicPageEnabled: true,
    isActive: true,
  };

  // Buscar laboratorio por handler
  let lab = await prisma.lab.findFirst({
    where: whereClause,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      province: true,
      country: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      tertiaryColor: true,
      fontColor: true,
      showCarnetPrints: true,
      showPolaroidPrints: true,
      soyFotografo: true,
      user: {
        select: {
          website: true,
          instagram: true,
          facebook: true,
          whatsapp: true,
        },
      },
    },
  });

  // En desarrollo, permitir ver la página aunque no esté habilitada/aprobada
  if (!lab && process.env.NODE_ENV !== "production") {
    lab = await prisma.lab.findFirst({
      where: {
        publicPageHandler: handler.toLowerCase(),
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        province: true,
        country: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        tertiaryColor: true,
        fontColor: true,
        showCarnetPrints: true,
        showPolaroidPrints: true,
        soyFotografo: true,
        user: {
          select: {
            website: true,
            instagram: true,
            facebook: true,
            whatsapp: true,
          },
        },
      },
    });
  }

  if (!lab) {
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

  lab.logoUrl = normalizeLogoUrl(lab.logoUrl);

  // Obtener álbumes del laboratorio solo si soyFotografo es true
  let labAlbums: any[] = [];
  if (lab.soyFotografo) {
    try {
      const labUser = await prisma.user.findFirst({
        where: {
          lab: {
            id: lab.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (labUser) {
        labAlbums = await prisma.album.findMany({
          where: {
            userId: labUser.id,
            isHidden: false,
            isPublic: true,
          },
          include: {
            photos: { select: { id: true } },
            coverPhoto: { select: { id: true, originalKey: true, previewUrl: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        });
        labAlbums = labAlbums.filter((album) => isAlbumPubliclyAccessible(album)).map((album) => ({
          ...album,
          coverPhotoUrl: album.coverThumbnailKey
            ? getR2PublicUrl(album.coverThumbnailKey)
            : album.coverPhoto
              ? (normalizePreviewUrl(album.coverPhoto.previewUrl, album.coverPhoto.originalKey) ?? (album.coverPhoto.originalKey ? getR2PublicUrl(album.coverPhoto.originalKey) : null))
              : null,
        }));
      }
    } catch (err) {
      console.error("Error obteniendo álbumes del lab:", err);
    }
  }

  // Obtener galerías de fotógrafos de la misma ciudad
  let photographerAlbums: any[] = [];
  if (lab.city && lab.province) {
    try {
      const photographers = await prisma.user.findMany({
        where: {
          role: "PHOTOGRAPHER",
          isPublicPageEnabled: true,
          city: lab.city,
          province: lab.province,
        },
        select: {
          id: true,
          name: true,
          publicPageHandler: true,
          logoUrl: true,
        },
        take: 20,
      });

      if (photographers.length > 0) {
        const photographerIds = photographers.map((p) => p.id);
        
        const albums = await prisma.album.findMany({
          where: {
            userId: { in: photographerIds },
            isHidden: false,
            isPublic: true,
          },
          include: {
            photos: { select: { id: true } },
            coverPhoto: { select: { id: true, originalKey: true, previewUrl: true } },
            user: {
              select: {
                id: true,
                name: true,
                publicPageHandler: true,
                logoUrl: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 24,
        });

        const visibleAlbums = albums.filter((album) => isAlbumPubliclyAccessible(album));
        photographerAlbums = visibleAlbums.map((album) => ({
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
          photographer: {
            id: album.user.id,
            name: album.user.name,
            handler: album.user.publicPageHandler,
            logoUrl: normalizeLogoUrl(album.user.logoUrl),
          },
        }));
      }
    } catch (err) {
      console.error("Error obteniendo galerías de fotógrafos:", err);
    }
  }

  const primaryColor = lab.primaryColor || "#c27b3d";
  const secondaryColor = lab.secondaryColor || "#2d2d2d";
  const tertiaryColor = lab.tertiaryColor || lab.primaryColor || "#c27b3d";
  const fontColor = lab.fontColor || "#1a1a1a";
  const showCarnet = lab.showCarnetPrints === true;
  const showPolaroids = lab.showPolaroidPrints === true;
  const appUrl = process.env.APP_URL;
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const baseUrl = appUrl || `${host.includes("localhost") ? "http" : "https"}://${host}`;
  const publicUrl = `${baseUrl}/l/${handler}`;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header
        className="text-white py-6"
        style={{ backgroundColor: secondaryColor }}
      >
        <div className="container-custom">
          <div className="flex items-center justify-end">
            <div className="flex gap-4">
              <Link href="/imprimir">
                <Button variant="secondary" className="bg-white text-gray-900 hover:bg-gray-100">
                  Imprimir Fotos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section
          className="text-white py-16 md:py-24"
          style={{ backgroundColor: secondaryColor }}
        >
          <div className="container-custom">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              {/* Logo del laboratorio centrado */}
              {lab.logoUrl ? (
                <div className="flex justify-center mb-6">
                  <Image
                    src={lab.logoUrl}
                    alt={lab.name}
                    width={375}
                    height={113}
                    className="h-20 md:h-[120px] w-auto object-contain max-w-full"
                    priority
                  />
                </div>
              ) : (
                <h1 className="text-4xl md:text-5xl font-bold mb-6">
                  {lab.name}
                </h1>
              )}
              {lab.city && lab.province && (
                <p className="text-xl text-gray-200">
                  {lab.city}, {lab.province}
                </p>
              )}
              {lab.address && (
                <p className="text-lg text-gray-300">
                  {lab.address}
                </p>
              )}
              {lab.phone && (
                <p className="text-lg text-gray-300">
                  📞 {lab.phone}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Compartir página */}
        <section className="py-8 md:py-12">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto">
              <LabPublicShare url={publicUrl} accentColor={tertiaryColor} />
            </div>
          </div>
        </section>

        {/* Sección de Imprimir Fotos */}
        <section className="py-12 md:py-16" style={{ backgroundColor: secondaryColor + "08" }}>
          <div className="container-custom">
            <div className="max-w-4xl mx-auto">
              {/* Mensaje informativo sobre impresión */}
              <div className="mb-8">
                <div className="bg-gradient-to-r rounded-lg p-5 border-2 shadow-sm" style={{ backgroundColor: `${tertiaryColor}08`, borderColor: `${tertiaryColor}30` }}>
                  <p className="text-base md:text-lg font-medium text-center" style={{ color: fontColor }}>
                    🖨️ <strong>Imprimí tus propias fotos:</strong> Subí tus fotos, elegí tamaño, cantidad y laboratorio. Todo 100% online.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-8 md:p-10 text-center border-2" style={{ borderColor: tertiaryColor ? `${tertiaryColor}4D` : undefined }}>
                  <div className="mb-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: tertiaryColor + "15" }}>
                      <svg
                        className="w-10 h-10"
                        style={{ color: tertiaryColor }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                  </div>
                  <Link href={`/l/${handler}/imprimir`}>
                    <Button
                      variant="primary"
                      className="text-lg px-8 py-4 font-semibold"
                      accentColor={tertiaryColor}
                      style={{
                        backgroundColor: tertiaryColor,
                        borderColor: tertiaryColor,
                      }}
                    >
                      Imprimir tus fotos
                    </Button>
                  </Link>
                </Card>

                {showCarnet && (
                  <Card className="p-8 md:p-10 text-center border-2" style={{ borderColor: tertiaryColor ? `${tertiaryColor}2B` : undefined }}>
                    <div className="mb-6">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: tertiaryColor + "12" }}>
                        <svg
                          className="w-10 h-10"
                          style={{ color: tertiaryColor }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4a4 4 0 100 8 4 4 0 000-8zm-7 16a7 7 0 0114 0H5z"
                          />
                        </svg>
                      </div>
                    </div>
                    <Link href={`/l/${handler}/fotocarnet`}>
                      <Button
                        variant="primary"
                        className="text-lg px-8 py-4 font-semibold"
                        accentColor={tertiaryColor}
                        style={{
                          backgroundColor: tertiaryColor,
                          borderColor: tertiaryColor,
                        }}
                      >
                        Fotos Carnet
                      </Button>
                    </Link>
                  </Card>
                )}

                {showPolaroids && (
                  <Card className="p-8 md:p-10 text-center border-2" style={{ borderColor: tertiaryColor ? `${tertiaryColor}2B` : undefined }}>
                    <div className="mb-6">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: tertiaryColor + "12" }}>
                        <svg
                          className="w-10 h-10"
                          style={{ color: tertiaryColor }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 7a2 2 0 012-2h8l4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
                          />
                        </svg>
                      </div>
                    </div>
                    <Link href={`/l/${handler}/polaroids`}>
                      <Button
                        variant="primary"
                        className="text-lg px-8 py-4 font-semibold"
                        accentColor={tertiaryColor}
                        style={{
                          backgroundColor: tertiaryColor,
                          borderColor: tertiaryColor,
                        }}
                      >
                        Polaroids
                      </Button>
                    </Link>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Álbumes del laboratorio (solo si está habilitado) */}
        {lab.soyFotografo && labAlbums.length > 0 && (
          <section className="py-12 bg-gray-50">
            <div className="container-custom">
              <h2 className="text-3xl font-bold text-center mb-8">Nuestros Álbumes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {labAlbums.map((album) => (
                  <Link key={album.id} href={`/a/${album.publicSlug || album.id}`}>
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                      {album.coverPhotoUrl ? (
                        <div className="aspect-square relative">
                          <Image
                            src={album.coverPhotoUrl}
                            alt={album.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="aspect-square bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400">Sin portada</span>
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-2">{album.title}</h3>
                        {album.location && (
                          <p className="text-sm text-gray-600 mb-1">📍 {album.location}</p>
                        )}
                        <p className="text-sm text-gray-500">
                          {album.photosCount} foto{album.photosCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Galerías de fotógrafos locales */}
        {photographerAlbums.length > 0 && (
          <section className="py-12 bg-white">
            <div className="container-custom">
              <h2 className="text-3xl font-bold text-center mb-4">
                Galerías de Fotógrafos en {lab.city}
              </h2>
              <p className="text-center text-gray-600 mb-8">
                Descubrí el trabajo de nuestros fotógrafos locales
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {photographerAlbums.map((album) => (
                  <Link
                    key={album.id}
                    href={`/a/${album.publicSlug || album.id}`}
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                      {album.coverPhotoUrl ? (
                        <div className="aspect-square relative">
                          <Image
                            src={album.coverPhotoUrl}
                            alt={album.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="aspect-square bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400">Sin portada</span>
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-2">{album.title}</h3>
                        {album.photographer && (
                          <div className="flex items-center gap-2 mb-2">
                            {album.photographer.logoUrl && (
                              <Image
                                src={album.photographer.logoUrl}
                                alt={album.photographer.name || "Fotógrafo"}
                                width={24}
                                height={24}
                                className="rounded-full object-cover"
                                unoptimized={album.photographer.logoUrl.startsWith("/uploads/")}
                              />
                            )}
                            <p className="text-sm text-gray-600">
                              Por {album.photographer.name}
                            </p>
                          </div>
                        )}
                        {album.location && (
                          <p className="text-sm text-gray-600 mb-1">📍 {album.location}</p>
                        )}
                        <p className="text-sm text-gray-500">
                          {album.photosCount} foto{album.photosCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Información de contacto y redes sociales */}
        <section className="py-12 bg-gray-50">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto">
              <div className="text-center space-y-4">
                {lab.address && (
                  <p className="text-base" style={{ color: fontColor }}>
                    📍 {lab.address}
                  </p>
                )}
                {lab.phone && (
                  <p className="text-base" style={{ color: fontColor }}>
                    📞 {lab.phone}
                  </p>
                )}
                {lab.email && (
                  <p className="text-base" style={{ color: fontColor }}>
                    ✉️ {lab.email}
                  </p>
                )}
                {/* Links de redes sociales */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                  {lab.user?.website && (
                    <a
                      href={lab.user.website.startsWith('http') ? lab.user.website : `https://${lab.user.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[#6b7280] hover:text-[#1a1a1a] transition-colors text-xs"
                      title="Página Web"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span className="hidden sm:inline">Web</span>
                    </a>
                  )}
                  
                  {lab.user?.instagram && (
                    <a
                      href={lab.user.instagram.startsWith('http') ? lab.user.instagram : lab.user.instagram.startsWith('@') ? `https://instagram.com/${lab.user.instagram.slice(1)}` : `https://instagram.com/${lab.user.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[#6b7280] hover:text-[#1a1a1a] transition-colors text-xs"
                      title="Instagram"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <span className="hidden sm:inline">Instagram</span>
                    </a>
                  )}
                  
                  {lab.user?.facebook && (
                    <a
                      href={lab.user.facebook.startsWith('http') ? lab.user.facebook : `https://facebook.com/${lab.user.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[#6b7280] hover:text-[#1a1a1a] transition-colors text-xs"
                      title="Facebook"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span className="hidden sm:inline">Facebook</span>
                    </a>
                  )}
                  
                  {lab.user?.whatsapp && (
                    <a
                      href={`https://wa.me/${lab.user.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[#6b7280] hover:text-[#25D366] transition-colors text-xs"
                      title="WhatsApp"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <LabPublicFooter lab={lab} />
    </div>
  );
}
