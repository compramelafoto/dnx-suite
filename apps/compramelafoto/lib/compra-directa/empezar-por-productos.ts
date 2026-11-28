/**
 * En una galería con fotos ocultas hasta la selfie, quien entra sin haberse verificado empieza por
 * «¿Qué querés llevar?» (`/a/[id]/llevar`): elige productos, después la selfie y después las fotos.
 * Se queda en la galería de siempre quien ya pasó la selfie, el fotógrafo, quien eligió «Primero
 * quiero ver las fotos» (`?ver=fotos`) o mira «como cliente» desde el panel, y las galerías que
 * todavía no venden o venden en otra moneda (esas tienen su propio checkout).
 */
export function debeEmpezarPorLosProductos(input: {
  hiddenPhotosEnabled: boolean;
  initialHasGrant: boolean;
  photographerBypassGrant: boolean;
  singlesPurchaseReady: boolean;
  isAccessBlocked: boolean;
  intl: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}): boolean {
  if (!input.hiddenPhotosEnabled || input.initialHasGrant || input.photographerBypassGrant) return false;
  if (!input.singlesPurchaseReady || input.isAccessBlocked || input.intl) return false;
  // Links que abren la galería para otra cosa (canje del pack, vista del fotógrafo) siguen igual.
  if (["preventaPackToken", "canje", "vista"].some((k) => input.searchParams[k] != null)) return false;
  const ver = input.searchParams.ver;
  if ((Array.isArray(ver) ? ver[0] : ver) === "fotos") return false;
  return true;
}
