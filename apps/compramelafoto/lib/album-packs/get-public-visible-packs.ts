import {
  buildPublicPackFromAlbumPackRow,
  isAlbumPackPubliclySellable,
  type AlbumPackRowForPublic,
  type PrintProductForPublicValidation,
  type PublicPack,
} from "@/lib/album-packs/public-pack";

export type { AlbumPackRowForPublic, PublicPack };

export function getPublicVisiblePacks(params: {
  packs: AlbumPackRowForPublic[];
  hasPublishedPhotos: boolean;
  printProductsById?: Map<number, PrintProductForPublicValidation>;
}): PublicPack[] {
  const { packs, hasPublishedPhotos, printProductsById } = params;
  const visible: PublicPack[] = [];

  for (const pack of packs) {
    if (!pack.isActive) continue;
    if (pack.packType === "SCHOOL_FOLDER") continue;
    if (pack.requiresDesign) continue;

    const phaseVisible = hasPublishedPhotos
      ? pack.availabilityPhase === "POST_UPLOAD" || pack.availabilityPhase === "ALWAYS"
      : pack.availabilityPhase === "PRE_UPLOAD" || pack.availabilityPhase === "ALWAYS";
    if (!phaseVisible) continue;

    const invalidSelection =
      pack.requiresSelection && (!pack.includedPhotoCount || pack.includedPhotoCount <= 0);
    if (invalidSelection) continue;

    if (!isAlbumPackPubliclySellable(pack, printProductsById)) continue;

    visible.push(buildPublicPackFromAlbumPackRow(pack));
  }

  return visible;
}
