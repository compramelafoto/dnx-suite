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
    // Un pack con diseño se vende solo si el diseño se puede armar: plantilla del diseñador nuevo
    // y fotos elegidas por el cliente (el armado sale de esa selección).
    if (pack.requiresDesign && (!pack.templateV2Id || !pack.requiresSelection)) continue;

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
