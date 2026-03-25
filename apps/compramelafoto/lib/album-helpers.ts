import { Prisma } from "@/lib/prisma";
import { TERMS_VERSION } from "@/lib/terms/photographerTerms";

export function publicAlbumFilter(): Prisma.AlbumWhereInput {
  return {
    isPublic: true,
    isHidden: false,
  };
}

type AlbumAccessData = {
  isPublic?: boolean | null;
  isHidden?: boolean | null;
  enablePrintedPhotos?: boolean | null;
  enableDigitalPhotos?: boolean | null;
  selectedLabId?: number | null;
  albumProfitMarginPercent?: number | null;
  pickupBy?: string | null;
  digitalPhotoPriceCents?: number | null;
  termsAcceptedAt?: Date | string | null;
  termsVersion?: string | null;
};

/**
 * FASE 1: Si enablePrintedPhotos=true y selectedLabId=null → impresión a cargo del fotógrafo,
 * solo se exige margen (hasMargin). FASE 2: Cuando selectedLabId != null, se exige también pickupBy.
 */
export function isAlbumComplete(album: AlbumAccessData): boolean {
  const enablePrinted = album.enablePrintedPhotos !== undefined ? Boolean(album.enablePrintedPhotos) : true;
  const enableDigital = album.enableDigitalPhotos !== undefined ? Boolean(album.enableDigitalPhotos) : true;
  const hasAnySale = enablePrinted || enableDigital;

  const marginValue = Number(album.albumProfitMarginPercent);
  const hasMargin = Number.isFinite(marginValue) ? marginValue >= 0 : false;
  // PHOTOGRAPHER mode (no lab): only margin. LAB mode: margin + pickupBy. TODO FASE 2: allowClientLabSelection when selectedLabId != null
  const hasPrintedConfig =
    enablePrinted &&
    hasMargin &&
    (album.selectedLabId == null ? true : Boolean(album.pickupBy));

  const digitalValue = Number(album.digitalPhotoPriceCents);
  const hasDigitalPrice = Number.isFinite(digitalValue) ? digitalValue > 0 : false;

  const termsOk = Boolean(album.termsAcceptedAt) && album.termsVersion === TERMS_VERSION;

  return (
    hasAnySale &&
    (!enablePrinted || hasPrintedConfig) &&
    (!enableDigital || hasDigitalPrice) &&
    termsOk
  );
}

/**
 * Visibilidad pública del álbum: solo depende de isPublic e isHidden.
 * Sin estado "borrador"; el álbum está disponible con el link si es público y no está oculto.
 */
export function isAlbumPubliclyAccessible(album: AlbumAccessData): boolean {
  return album.isPublic === true && album.isHidden !== true;
}
