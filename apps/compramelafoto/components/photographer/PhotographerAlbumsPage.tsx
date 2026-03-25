"use client";

import Link from "next/link";
import Image from "next/image";
import PhotographerHeader from "./PhotographerHeader";
import PhotographerFooter from "./PhotographerFooter";
import Card from "@/components/ui/Card";

type Photographer = {
  id: number;
  name: string | null;
  email: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  preferredLabId: number | null;
  profitMarginPercent: number | null;
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

export default function PhotographerAlbumsPage({
  photographer,
  handler,
  albums,
}: {
  photographer: Photographer;
  handler: string;
  albums: Album[];
}) {
  const primaryColor = photographer.primaryColor || "#c27b3d";
  const secondaryColor = photographer.secondaryColor || "#2d2d2d";

  return (
    <>
      <PhotographerHeader photographer={photographer} handler={handler} />
      <main className="flex-1">
        {/* Hero Section */}
        <section
          className="text-white py-20 md:py-32"
          style={{ backgroundColor: secondaryColor }}
        >
          <div className="container-custom">
            <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
              <div
                style={{
                  textAlign: "center",
                  padding: "0 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                <h1
                  style={{
                    fontSize: "clamp(24px, 5vw, 36px)",
                    fontWeight: "normal",
                    color: "#ffffff",
                    lineHeight: "1.3",
                    margin: 0,
                    width: "100%",
                    maxWidth: "800px",
                    wordBreak: "normal",
                    overflowWrap: "normal",
                    whiteSpace: "normal",
                  }}
                >
                  Mis álbumes
                </h1>
                <p
                  style={{
                    fontSize: "clamp(16px, 2.5vw, 18px)",
                    color: "#e0e0e0",
                    lineHeight: "1.5",
                    margin: 0,
                    width: "100%",
                    maxWidth: "800px",
                    wordBreak: "normal",
                    overflowWrap: "normal",
                    whiteSpace: "normal",
                  }}
                >
                  Explorá y comprá fotos de tus eventos favoritos
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Albums Grid */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container-custom">
            {albums.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#6b7280] text-lg">
                  No hay álbumes disponibles en este momento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {albums.map((album) => (
                  <Link
                    key={album.id}
                    href={`/a/${album.publicSlug}`}
                    className="block"
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="aspect-square bg-[#f3f4f6] relative">
                        {album.coverPhotoUrl ? (
                          <Image
                            src={album.coverPhotoUrl}
                            alt={album.title}
                            fill
                            className="object-cover"
                          />
                        ) : album.showComingSoonMessage ? (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4">
                            <Image
                              src="/watermark.png"
                              alt="ComprameLaFoto"
                              width={120}
                              height={120}
                              className="opacity-50"
                            />
                            <p className="text-xs text-[#6b7280] mt-2 text-center">
                              Las fotos serán subidas próximamente
                            </p>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg
                              className="w-16 h-16 text-[#9ca3af]"
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
                      </div>
                      <div className="p-4">
                        <h3 className="text-lg font-medium text-[#1a1a1a] mb-2">
                          {album.title}
                        </h3>
                        {album.location && (
                          <p className="text-sm text-[#6b7280] mb-1">
                            📍 {album.location}
                          </p>
                        )}
                        {album.eventDate && (
                          <p className="text-sm text-[#6b7280] mb-2">
                            📅 {new Date(album.eventDate).toLocaleDateString("es-AR")}
                          </p>
                        )}
                        <p className="text-sm text-[#6b7280]">
                          {album.photosCount} {album.photosCount === 1 ? "foto" : "fotos"}
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <PhotographerFooter photographer={photographer} />
    </>
  );
}
