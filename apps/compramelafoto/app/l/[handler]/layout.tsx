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
  const logoUrl = normalizeLogoUrl(lab.logoUrl);
  const ogImage = logoUrl ? (logoUrl.startsWith("http") ? logoUrl : `${siteUrl}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`) : `${siteUrl}/watermark.png`;
  return {
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

export default function LabHandlerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
