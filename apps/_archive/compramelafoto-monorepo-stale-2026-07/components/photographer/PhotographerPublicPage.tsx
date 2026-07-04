"use client";

import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PhotographerHeader from "./PhotographerHeader";
import PhotographerFooter from "./PhotographerFooter";

type Photographer = {
  id: number;
  name: string | null;
  email: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor?: string | null;
  fontColor?: string | null;
  headerBackgroundColor?: string | null;
  footerBackgroundColor?: string | null;
  heroBackgroundColor?: string | null;
  pageBackgroundColor?: string | null;
  preferredLabId: number | null;
  profitMarginPercent: number | null;
  enableAlbumsPage?: boolean;
  enablePrintPage?: boolean;
  showCarnetPrints?: boolean;
  showPolaroidPrints?: boolean;
  website?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  companyAddress?: string | null;
  companyName?: string | null;
};

type Album = {
  id: number;
  title: string;
  location: string | null;
  eventDate: Date | null;
  publicSlug: string;
  createdAt: Date;
  photosCount: number;
  coverPhotoUrl: string | null;
  showComingSoonMessage: boolean;
};

export default function PhotographerPublicPage({
  photographer,
  handler,
  albums = [],
  hideLogo = false,
}: {
  photographer: Photographer;
  handler: string;
  albums?: Album[];
  hideLogo?: boolean;
}) {
  const primaryColor = photographer.primaryColor || "#c27b3d";
  const secondaryColor = photographer.secondaryColor || "#2d2d2d";
  const tertiaryColor = photographer.tertiaryColor || photographer.primaryColor || "#c27b3d";
  const fontColor = photographer.fontColor || "#1a1a1a";
  const heroBg = photographer.heroBackgroundColor ?? secondaryColor;
  const pageBg = photographer.pageBackgroundColor ?? "#ffffff";
  const toRgba = (hex: string, alpha: number) => {
    const normalized = hex.trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      return `rgba(26, 26, 26, ${alpha})`;
    }
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  /** Luminancia relativa 0–1: fondos claros > ~0.55 */
  const getBgLuminance = (hex: string) => {
    const h = hex.trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return 0.35;
    const r = parseInt(h.slice(1, 3), 16) / 255;
    const g = parseInt(h.slice(3, 5), 16) / 255;
    const b = parseInt(h.slice(5, 7), 16) / 255;
    const lin = [r, g, b].map((c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const heroIsLight = getBgLuminance(heroBg) > 0.55;
  const mutedFontColor = toRgba(fontColor, 0.65);
  const softFontColor = toRgba(fontColor, 0.85);
  const heroIntroColor = heroIsLight ? softFontColor : "rgba(255, 255, 255, 0.95)";
  const showCarnet = photographer.showCarnetPrints === true;
  const showPolaroids = photographer.showPolaroidPrints === true;
  
  return (
    <>
      <PhotographerHeader photographer={photographer} handler={handler} hideLogo={hideLogo} />
      <main className="flex-1">
        {/* Hero Section - oculto en embed */}
        {!hideLogo && (
        <section
          className="py-16 md:py-24"
          style={{ backgroundColor: heroBg }}
        >
          <div className="container-custom">
            <div className="max-w-4xl mx-auto text-center space-y-6" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
              <p
                style={{
                  fontSize: "clamp(24px, 3.75vw, 30px)",
                  color: heroIntroColor,
                  lineHeight: "1.6",
                  margin: 0,
                  marginTop: "1.5rem",
                  wordBreak: "normal",
                  overflowWrap: "normal",
                  whiteSpace: "normal",
                }}
              >
                Compra tus fotos de la manera que desees. Todo 100% online.
              </p>
            </div>
          </div>
        </section>
        )}

        {/* Albums Grid Section */}
        {photographer.enableAlbumsPage === true && albums.length > 0 && (
          <section className="py-12 md:py-16" style={{ backgroundColor: pageBg }}>
            <div className="container-custom">
              {/* Mensaje informativo sobre álbumes */}
              <div className="mb-8">
                <div className="bg-gradient-to-r rounded-lg p-5 border-2 shadow-sm" style={{ backgroundColor: `${primaryColor}08`, borderColor: `${primaryColor}30` }}>
                  <p className="text-base md:text-lg font-medium text-center" style={{ color: fontColor }}>
                    📸 <strong>Busca el álbum donde está tu foto y comprala 100% online.</strong> Hacé clic en cualquier álbum para ver todas las opciones disponibles.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {albums.map((album) => (
                  <Link
                    key={album.id}
                    href={`/a/${album.publicSlug}`}
                    className="group block"
                  >
                    <Card className="overflow-hidden h-full hover:shadow-xl transition-all duration-300 border-2" style={{ borderColor: tertiaryColor ? `${tertiaryColor}33` : undefined }}>
                      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                        {album.coverPhotoUrl ? (
                          <Image
                            src={album.coverPhotoUrl}
                            alt={album.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : album.showComingSoonMessage ? (
                          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br" style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15)` }}>
                            <Image
                              src="/watermark.png"
                              alt="ComprameLaFoto"
                              width={120}
                              height={120}
                              className="opacity-50"
                            />
                            <p className="text-xs mt-3 text-center font-medium" style={{ color: mutedFontColor }}>
                              Las fotos serán subidas próximamente
                            </p>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br" style={{ background: `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}10)` }}>
                            <svg
                              className="w-16 h-16"
                              style={{ color: primaryColor, opacity: 0.3 }}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                      </div>
                      <div className="p-5">
                        <h3 className="text-lg font-semibold mb-2 line-clamp-2 group-hover:text-opacity-80 transition-colors" style={{ color: fontColor }}>
                          {album.title}
                        </h3>
                        <div className="space-y-1 mb-3">
                          {album.location && (
                            <p className="text-sm flex items-center gap-1" style={{ color: mutedFontColor }}>
                              <span>📍</span> {album.location}
                            </p>
                          )}
                          {album.eventDate && (
                            <p className="text-sm flex items-center gap-1" style={{ color: mutedFontColor }}>
                              <span>📅</span> {new Date(album.eventDate).toLocaleDateString("es-AR")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[#e5e7eb]">
                          <span className="text-sm font-medium" style={{ color: primaryColor }}>
                            {album.photosCount} {album.photosCount === 1 ? "foto" : "fotos"}
                          </span>
                          <span className="text-sm transition-colors" style={{ color: mutedFontColor }}>
                            Ver álbum →
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Print Photos Section */}
        {photographer.enablePrintPage === true && (() => {
          const cardCount = 1 + (showCarnet ? 1 : 0) + (showPolaroids ? 1 : 0);
          const gridCols = cardCount === 1 ? "md:grid-cols-1" : cardCount === 2 ? "md:grid-cols-2" : "md:grid-cols-3";
          return (
          <section className="py-12 md:py-16" style={{ backgroundColor: pageBg }}>
            <div className="container-custom">
              <div className="w-full max-w-4xl mx-auto mb-8">
                {/* Mensaje informativo sobre impresión */}
                <div className="bg-gradient-to-r rounded-lg p-5 border-2 shadow-sm" style={{ backgroundColor: `${tertiaryColor}08`, borderColor: `${tertiaryColor}30` }}>
                  <p className="text-base md:text-lg font-medium text-center" style={{ color: fontColor }}>
                    🖨️ <strong>Imprimí tus propias fotos:</strong> Subí tus fotos, elegí tamaño, cantidad y laboratorio. Todo 100% online.
                  </p>
                </div>
              </div>
              <div className={`grid grid-cols-1 ${gridCols} gap-6 w-full max-w-6xl mx-auto`}>
                  <Card className="p-6 md:p-10 text-center border-2 flex flex-col min-w-0 flex-1" style={{ borderColor: tertiaryColor ? `${tertiaryColor}4D` : undefined }}>
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
                    <Link href={`/${handler}/imprimir`}>
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
                    <Card className="p-6 md:p-10 text-center border-2 flex flex-col min-w-0 flex-1" style={{ borderColor: tertiaryColor ? `${tertiaryColor}2B` : undefined }}>
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
                      <Link href={`/${handler}/fotocarnet`}>
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
                    <Card className="p-6 md:p-10 text-center border-2 flex flex-col min-w-0 flex-1" style={{ borderColor: tertiaryColor ? `${tertiaryColor}2B` : undefined }}>
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
                      <Link href={`/${handler}/polaroids`}>
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
          </section>
          );
        })()}

        {/* Empty State */}
        {photographer.enableAlbumsPage === true && albums.length === 0 && photographer.enablePrintPage !== true && (
          <section className="py-16 md:py-24">
            <div className="container-custom">
              <div className="text-center">
                <p className="text-lg" style={{ color: mutedFontColor }}>
                  No hay álbumes disponibles en este momento.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Redes sociales - oculto en embed */}
        {!hideLogo && (photographer.website || photographer.instagram || photographer.tiktok || photographer.facebook || photographer.whatsapp) && (
          <section className="py-8 border-t border-[#e5e7eb] bg-white/50">
            <div className="container-custom">
              <div className="flex flex-col items-center gap-4">
                {/* Logo de la empresa */}
                {photographer.logoUrl && (
                  <div className="mb-2">
                    <Image
                      src={photographer.logoUrl}
                      alt={photographer.companyName || photographer.name || "Logo"}
                      width={200}
                      height={60}
                      className="h-12 md:h-16 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                      unoptimized={photographer.logoUrl.startsWith("/uploads/")}
                    />
                  </div>
                )}
                {/* Links de redes sociales */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                {photographer.website && (
                  <a
                    href={photographer.website.startsWith('http') ? photographer.website : `https://${photographer.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 transition-colors text-xs"
                    style={{ color: mutedFontColor }}
                    title="Página Web"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span className="hidden sm:inline">Web</span>
                  </a>
                )}
                
                {photographer.instagram && (
                  <a
                    href={photographer.instagram.startsWith('http') ? photographer.instagram : photographer.instagram.startsWith('@') ? `https://instagram.com/${photographer.instagram.slice(1)}` : `https://instagram.com/${photographer.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 transition-colors text-xs"
                    style={{ color: mutedFontColor }}
                    title="Instagram"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    <span className="hidden sm:inline">Instagram</span>
                  </a>
                )}
                
                {photographer.tiktok && (
                  <a
                    href={photographer.tiktok.startsWith('http') ? photographer.tiktok : photographer.tiktok.startsWith('@') ? `https://tiktok.com/@${photographer.tiktok.slice(1)}` : `https://tiktok.com/@${photographer.tiktok}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 transition-colors text-xs"
                    style={{ color: mutedFontColor }}
                    title="TikTok"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                    <span className="hidden sm:inline">TikTok</span>
                  </a>
                )}
                
                {photographer.facebook && (
                  <a
                    href={photographer.facebook.startsWith('http') ? photographer.facebook : `https://facebook.com/${photographer.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 transition-colors text-xs"
                    style={{ color: mutedFontColor }}
                    title="Facebook"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span className="hidden sm:inline">Facebook</span>
                  </a>
                )}
                
                {photographer.whatsapp && (
                  <a
                    href={`https://wa.me/${photographer.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 transition-colors text-xs"
                    style={{ color: mutedFontColor }}
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
          </section>
        )}
      </main>
      <PhotographerFooter photographer={photographer} hideLogo={hideLogo} />
    </>
  );
}
