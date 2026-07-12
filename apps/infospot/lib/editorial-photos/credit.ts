/**
 * Crédito editorial obligatorio (fotógrafo + plataforma).
 */

export function buildEditorialPhotoCredit(input: {
  photographerName: string | null | undefined;
  platform?: string;
}): string {
  const name = input.photographerName?.trim() || "Fotógrafo";
  const platform = input.platform?.trim() || "ComprameLaFoto";
  return `Foto: ${name} / ${platform}`;
}

export function buildEditorialPhotoCopyright(
  photographerName: string | null | undefined,
): string {
  const name = photographerName?.trim() || "el autor";
  return `© ${name}. Uso editorial Info Spot.`;
}
