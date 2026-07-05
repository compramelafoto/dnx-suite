import { prisma } from "@/lib/prisma";

export type OrganizerDownloadAllowance = {
  photographersWithPhotos: number;
  maxDownloads: number;
  usedDownloads: number;
  remainingDownloads: number;
};

export async function getOrganizerDownloadAllowance(params: {
  eventId: number;
  organizerId: number;
}): Promise<OrganizerDownloadAllowance> {
  const { eventId, organizerId } = params;

  const albums = await prisma.album.findMany({
    where: {
      eventId,
      deletedAt: null,
      isHidden: false,
      isPublic: true,
    },
    select: {
      userId: true,
      photos: {
        where: { isRemoved: false },
        select: { id: true },
        take: 1,
      },
    },
  });

  const photographersWithPhotos = new Set(
    albums.filter((a) => a.photos.length > 0).map((a) => a.userId)
  );
  const maxDownloads = photographersWithPhotos.size * 5;
  const usedDownloads = await prisma.organizerEventDownload.count({
    where: { eventId, organizerId },
  });
  const remainingDownloads = Math.max(maxDownloads - usedDownloads, 0);

  return {
    photographersWithPhotos: photographersWithPhotos.size,
    maxDownloads,
    usedDownloads,
    remainingDownloads,
  };
}
