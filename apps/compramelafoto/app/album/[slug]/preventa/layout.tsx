import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl, urlToR2Key } from "@/lib/r2-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await Promise.resolve(params);
  if (!slug) return {};

  const album = await prisma.album.findUnique({
    where: { publicSlug: slug },
    select: {
      title: true,
      user: { select: { name: true } },
      school: { select: { name: true, logoUrl: true } },
    },
  });

  if (!album) return {};

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");
  const schoolLogo = normalizeLogoUrl(album.school?.logoUrl ?? null);
  const ogImage = schoolLogo
    ? schoolLogo.startsWith("http")
      ? schoolLogo
      : `${siteUrl}${schoolLogo.startsWith("/") ? "" : "/"}${schoolLogo}`
    : `${siteUrl}/watermark.png`;

  const albumTitle = (album.title || "Preventa").trim();
  const schoolName = (album.school?.name || "").trim();
  const photographerName = (album.user?.name || "ComprameLaFoto").trim();
  const displayName = schoolName || albumTitle;
  const subtitle =
    schoolName && albumTitle && schoolName.toLowerCase() !== albumTitle.toLowerCase()
      ? `Álbum ${albumTitle}`
      : null;
  const title = `Preventa ${displayName} | ${photographerName}`;
  const description = subtitle
    ? `Preventa oficial de ${displayName}. ${subtitle}. Reservá tu pack y elegí tus fotos cuando estén listas.`
    : `Preventa oficial de ${displayName}. Reservá tu pack y elegí tus fotos cuando estén listas.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "ComprameLaFoto",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 1200,
          alt: displayName,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function PreventaAlbumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
