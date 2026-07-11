/** Crédito público estándar Info Spot × CLF. */
export function buildClfPhotoCredit(photographerName: string | null | undefined): string {
  const name = photographerName?.trim() || "Fotógrafo";
  return `Foto: ${name} / Info Spot – ComprameLaFoto`;
}

export function buildClfCopyright(photographerName: string | null | undefined): string {
  const name = photographerName?.trim() || "el autor";
  return `© ${name}. Uso editorial Info Spot.`;
}
