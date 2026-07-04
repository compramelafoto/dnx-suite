type AlbumPackAvailabilityPhase = "PRE_UPLOAD" | "POST_UPLOAD" | "ALWAYS";

export type PublicAlbumPack = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  includedPhotoCount: number | null;
  requiresSelection: boolean;
  requiresDesign: boolean;
  availabilityPhase: AlbumPackAvailabilityPhase | string;
  isActive: boolean;
};

export type VisiblePublicAlbumPack = PublicAlbumPack & {
  previewOnly: boolean;
};

type GetPublicVisiblePacksParams = {
  packs: PublicAlbumPack[];
  hasPhotos: boolean;
  albumMode?: string | null;
  isOwnerOrAdminPreview?: boolean;
};

export function getPublicVisiblePacks({
  packs,
  hasPhotos,
  albumMode,
  isOwnerOrAdminPreview = false,
}: GetPublicVisiblePacksParams): VisiblePublicAlbumPack[] {
  const activePacks = packs.filter((pack) => pack.isActive);
  const isTestPreview = albumMode === "TEST" && isOwnerOrAdminPreview;

  if (isTestPreview) {
    return activePacks.map((pack) => ({ ...pack, previewOnly: true }));
  }

  return activePacks
    .filter((pack) => {
      const phase = pack.availabilityPhase as AlbumPackAvailabilityPhase;
      if (hasPhotos) {
        return phase === "POST_UPLOAD" || phase === "ALWAYS";
      }
      return phase === "PRE_UPLOAD" || phase === "ALWAYS";
    })
    .map((pack) => ({ ...pack, previewOnly: false }));
}
