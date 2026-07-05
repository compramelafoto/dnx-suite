import { prisma } from "@/lib/prisma";
import { resolveHiddenAlbumVisitorAccess } from "@/lib/hidden-album-audit";

export type PublicAlbumPhotoRow = {
  id: number;
  previewUrl: string;
  originalKey: string;
};

export async function filterPublicAlbumPhotosForHiddenVisitor(
  albumId: number,
  hiddenPhotosEnabled: boolean,
  allPhotos: PublicAlbumPhotoRow[],
  options: {
    photographerBypassGrant: boolean;
    simulateClientView: boolean;
    grantCookieValue: string | null;
  }
): Promise<{ initialHasGrant: boolean; photos: PublicAlbumPhotoRow[] }> {
  const photographerBypass = options.photographerBypassGrant && !options.simulateClientView;
  if (!hiddenPhotosEnabled) {
    return { initialHasGrant: photographerBypass, photos: allPhotos };
  }
  if (photographerBypass) {
    return { initialHasGrant: true, photos: allPhotos };
  }

  const grant = await resolveHiddenAlbumVisitorAccess(albumId, options.grantCookieValue, prisma);
  if (grant.hasGrant) {
    const allowed = new Set(grant.allowedPhotoIds ?? []);
    return {
      initialHasGrant: true,
      photos: allPhotos.filter((p) => allowed.has(p.id)),
    };
  }

  return { initialHasGrant: false, photos: [] };
}
