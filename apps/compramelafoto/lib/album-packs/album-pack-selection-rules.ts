import type { AlbumPack } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  isAlbumPackAllEventPhotosMode,
  isAlbumPackAllMyPhotosMode,
} from "@/lib/album-packs/album-pack-quantity-mode";

export class AlbumPackSelectionRuleError extends Error {
  constructor(message: string, public readonly code: string = "ALBUM_PACK_SELECTION_RULE") {
    super(message);
    this.name = "AlbumPackSelectionRuleError";
  }
}

export function normalizePhotoIds(photoIds: number[]): number[] {
  const normalized = Array.from(
    new Set(
      photoIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
        .map((id) => Math.trunc(id))
    )
  );
  return normalized;
}

export async function validatePackExistsForAlbum(
  albumId: number,
  albumPackId: string
): Promise<AlbumPack> {
  const pack = await prisma.albumPack.findFirst({
    where: { id: albumPackId, albumId },
  });
  if (!pack) {
    throw new AlbumPackSelectionRuleError(
      "El pack no existe o no pertenece al álbum.",
      "PACK_NOT_FOUND_FOR_ALBUM"
    );
  }
  return pack;
}

export function validatePackIsActive(pack: Pick<AlbumPack, "isActive">): void {
  if (!pack.isActive) {
    throw new AlbumPackSelectionRuleError("El pack está inactivo.", "PACK_INACTIVE");
  }
}

/** Pack “todas mis fotos” o “todas las fotos”: sin cantidad fija en grilla. */
export function isAlbumPackAllPhotosSelection(
  pack: Pick<AlbumPack, "requiresSelection" | "requiresDesign" | "description">
): boolean {
  return isAlbumPackAllMyPhotosMode(pack) || isAlbumPackAllEventPhotosMode(pack);
}

export function validatePackRequiresSelection(
  pack: Pick<AlbumPack, "requiresSelection">
): void {
  if (!pack.requiresSelection) {
    throw new AlbumPackSelectionRuleError(
      "Este pack no requiere selección de fotos.",
      "PACK_DOES_NOT_REQUIRE_SELECTION"
    );
  }
}

export function validateAllPhotosPackHasMatches(photoIds: number[]): void {
  if (photoIds.length < 1) {
    throw new AlbumPackSelectionRuleError(
      "No hay fotos para este pack. Usá la búsqueda por IA con una selfie.",
      "PACK_ALL_PHOTOS_EMPTY"
    );
  }
}

export function validatePhotoCountAgainstPack(
  photoIds: number[],
  includedPhotoCount: number | null,
  mode: "max" | "exact"
): void {
  const count = photoIds.length;
  if (includedPhotoCount == null) return;
  if (includedPhotoCount <= 0) {
    throw new AlbumPackSelectionRuleError(
      "El pack no tiene una cantidad de fotos válida.",
      "PACK_INCLUDED_COUNT_INVALID"
    );
  }

  if (mode === "max" && count > includedPhotoCount) {
    throw new AlbumPackSelectionRuleError(
      `Seleccionaste ${count} fotos y el pack permite hasta ${includedPhotoCount}.`,
      "PACK_SELECTION_EXCEEDS_MAX"
    );
  }

  if (mode === "exact" && count !== includedPhotoCount) {
    throw new AlbumPackSelectionRuleError(
      `Este pack requiere exactamente ${includedPhotoCount} foto(s).`,
      "PACK_SELECTION_COUNT_NOT_EXACT"
    );
  }
}

export async function validatePhotosBelongToAlbum(
  albumId: number,
  photoIds: number[]
): Promise<void> {
  if (photoIds.length === 0) return;
  const count = await prisma.photo.count({
    where: {
      albumId,
      id: { in: photoIds },
      isRemoved: false,
    },
  });
  if (count !== photoIds.length) {
    throw new AlbumPackSelectionRuleError(
      "Una o más fotos no pertenecen al álbum o no están disponibles.",
      "PHOTOS_NOT_IN_ALBUM"
    );
  }
}

export async function validateAlbumPackSelectionInput(params: {
  albumId: number;
  albumPackId: string;
  photoIds: number[];
  countMode: "max" | "exact";
}): Promise<{ pack: AlbumPack; photoIds: number[] }> {
  const photoIds = normalizePhotoIds(params.photoIds);
  const pack = await validatePackExistsForAlbum(params.albumId, params.albumPackId);
  validatePackIsActive(pack);
  if (isAlbumPackAllMyPhotosMode(pack) || isAlbumPackAllEventPhotosMode(pack)) {
    validateAllPhotosPackHasMatches(photoIds);
  } else {
    validatePackRequiresSelection(pack);
    validatePhotoCountAgainstPack(photoIds, pack.includedPhotoCount, params.countMode);
  }
  await validatePhotosBelongToAlbum(params.albumId, photoIds);
  return { pack, photoIds };
}
