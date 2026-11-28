import { parsePackQtyFromDescription } from "@/lib/album-packs/album-pack-quantity-mode";

/**
 * «Este evento dura varios días»: sólo en packs «Todas mis fotos» digitales.
 * Con copias impresas, cada foto que se suma sería una impresión que nadie cobró.
 */
export function packCanKeepAddingPhotos(pack: {
  description: string | null | undefined;
  packType: string | null | undefined;
  /** Tipos de los componentes del pack. Un pack mixto (digital + impresión) figura como DIGITAL. */
  componentKinds?: readonly string[];
}): boolean {
  return (
    parsePackQtyFromDescription(pack.description) === "ALL_MY_PHOTOS" &&
    pack.packType === "DIGITAL" &&
    !(pack.componentKinds ?? []).includes("PRINT")
  );
}

export const KEEPS_ADDING_PHOTOS_NOT_ALLOWED =
  "«Este evento dura varios días» sólo se puede usar en packs «Todas mis fotos» de fotos digitales.";

/**
 * Valor final de `keepsAddingPhotos` al guardar un pack.
 * - Si lo piden encendido en un pack que no lo admite: error.
 * - Si el pack deja de admitirlo (cambió a impresiones o a otro modo): se apaga solo.
 */
export function resolveKeepsAddingPhotos(params: {
  requested: boolean | undefined;
  current: boolean;
  description: string | null | undefined;
  packType: string | null | undefined;
  componentKinds?: readonly string[];
}): { ok: true; value: boolean } | { ok: false; error: string } {
  const allowed = packCanKeepAddingPhotos(params);
  const wanted = params.requested ?? params.current;
  if (params.requested === true && !allowed) {
    return { ok: false, error: KEEPS_ADDING_PHOTOS_NOT_ALLOWED };
  }
  return { ok: true, value: wanted && allowed };
}
