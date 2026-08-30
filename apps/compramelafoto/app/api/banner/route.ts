import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BANNER_KEY = "home_banner_images";

export type BannerSlide = {
  src: string;
  alt: string;
  link?: string;
  openInNewTab?: boolean;
};

/**
 * GET /api/banner
 * Público: devuelve las imágenes del banner del home para el slide.
 * Si el banner está deshabilitado, devuelve images: [].
 */
export async function GET() {
  try {
    const row = await prisma.systemSettings.findUnique({
      where: { key: BANNER_KEY },
    });
    if (!row?.value) {
      return NextResponse.json({ enabled: true, images: [] });
    }
    const parsed = JSON.parse(row.value) as unknown;
    // Formato nuevo: { enabled, images }; formato antiguo: array
    const isLegacyArray = Array.isArray(parsed);
    const enabled = isLegacyArray ? true : (parsed as { enabled?: boolean }).enabled !== false;
    if (!enabled) {
      return NextResponse.json({ enabled: false, images: [] });
    }
    const images = isLegacyArray ? (parsed as BannerSlide[]) : (parsed as { images?: unknown }).images;
    const arr = Array.isArray(images) ? images : [];
    const valid = arr.filter(
      (x): x is BannerSlide => typeof x?.src === "string" && typeof x?.alt === "string"
    ).map((x) => ({
      src: x.src,
      alt: x.alt,
      link: typeof x.link === "string" ? x.link : undefined,
      openInNewTab: Boolean(x.openInNewTab),
    }));
    return NextResponse.json({ enabled: true, images: valid });
  } catch {
    return NextResponse.json({ enabled: true, images: [] });
  }
}
