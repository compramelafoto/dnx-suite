import type { PrismaClient } from "@/lib/prisma";
import { sanitizeWatermarkAscii } from "@/lib/images/watermark-svg-font";

const photographerSelect = {
  companyName: true,
  publicPageHandler: true,
  name: true,
} as const;

export const PHOTOGRAPHER_CENTER_WATERMARK_WINDOW_DAYS = 7;
export const DEFAULT_CENTER_WATERMARK_TEXT = "compramelafoto.com";

export type PhotographerWatermarkUser = {
  companyName?: string | null;
  publicPageHandler?: string | null;
  name?: string | null;
};

export type AlbumWatermarkContext = {
  firstPhotoDate?: Date | null;
  createdAt?: Date | null;
};

export function isAlbumWithinPhotographerCenterWatermarkWindow(
  album: AlbumWatermarkContext,
  now: Date = new Date()
): boolean {
  const anchor = album.firstPhotoDate ?? album.createdAt;
  if (!anchor) return false;
  const windowMs = PHOTOGRAPHER_CENTER_WATERMARK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return anchor.getTime() >= now.getTime() - windowMs;
}

export function resolvePhotographerWatermarkLabel(user: PhotographerWatermarkUser): string | null {
  const raw =
    user.companyName?.trim() ||
    user.publicPageHandler?.trim() ||
    user.name?.trim() ||
    "";
  if (!raw) return null;
  const sanitized = sanitizeWatermarkAscii(raw).replace(/\s+/g, " ").trim();
  if (!sanitized) return null;
  return sanitized.toUpperCase();
}

export function buildPhotographerCenterWatermarkText(user: PhotographerWatermarkUser): string | null {
  const label = resolvePhotographerWatermarkLabel(user);
  if (!label) return null;
  return `PH : ${label}`;
}

/** Texto central del SVG; undefined = usar default (compramelafoto.com). */
export function resolveCenterWatermarkText(params: {
  album: AlbumWatermarkContext;
  photographer: PhotographerWatermarkUser;
  now?: Date;
}): string | undefined {
  if (!isAlbumWithinPhotographerCenterWatermarkWindow(params.album, params.now)) {
    return undefined;
  }
  return buildPhotographerCenterWatermarkText(params.photographer) ?? undefined;
}

export async function loadCenterWatermarkTextForPhoto(
  prisma: PrismaClient,
  params: { photoId: number; albumId: number }
): Promise<string | undefined> {
  const [album, photo] = await Promise.all([
    prisma.album.findUnique({
      where: { id: params.albumId },
      select: {
        firstPhotoDate: true,
        createdAt: true,
        user: { select: photographerSelect },
      },
    }),
    prisma.photo.findUnique({
      where: { id: params.photoId },
      select: {
        uploadedBy: { select: photographerSelect },
      },
    }),
  ]);
  if (!album) return undefined;
  const photographer = photo?.uploadedBy ?? album.user;
  return resolveCenterWatermarkText({ album, photographer });
}
