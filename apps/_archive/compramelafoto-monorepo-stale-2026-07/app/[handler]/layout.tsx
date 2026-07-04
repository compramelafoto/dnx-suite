import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl, urlToR2Key } from "@/lib/r2-client";
import { isReservedPhotographerSlug } from "@/lib/photographer-slugs";

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
  params: { handler: string } | Promise<{ handler: string }>;
}): Promise<Metadata> {
  const { handler } = await Promise.resolve(params);
  if (!handler || typeof handler !== "string") return {};
  const normalizedHandler = handler.toLowerCase();
  const photographer = await prisma.user.findFirst({
    where: {
      publicPageHandler: normalizedHandler,
      isPublicPageEnabled: true,
      role: "PHOTOGRAPHER",
    },
    select: { name: true, companyName: true, logoUrl: true },
  });
  if (!photographer) return {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");
  const logoUrl = normalizeLogoUrl(photographer.logoUrl);
  const ogImage = logoUrl ? (logoUrl.startsWith("http") ? logoUrl : `${siteUrl}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`) : `${siteUrl}/watermark.png`;
  const name = photographer.name || photographer.companyName || "Fotógrafo";
  return {
    openGraph: {
      title: `${name} - ComprameLaFoto`,
      description: `Comprá y descargá fotos digitales e impresas de ${name}.`,
      images: [{ url: ogImage }],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${name} - ComprameLaFoto`,
      description: `Comprá y descargá fotos digitales e impresas de ${name}.`,
      images: [ogImage],
    },
  };
}

export default async function PhotographerHandlerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { handler: string } | Promise<{ handler: string }>;
}) {
  const { handler } = await Promise.resolve(params);

  if (!handler || typeof handler !== "string") {
    notFound();
  }

  const normalizedHandler = handler.toLowerCase();
  if (isReservedPhotographerSlug(normalizedHandler)) {
    notFound();
  }

  return <>{children}</>;
}
