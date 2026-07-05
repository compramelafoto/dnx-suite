const APP_URL =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

/** Ruta relativa del centro de descargas (token opaco del pedido). */
export function getDownloadCenterPath(accessToken: string): string {
  return `/descargas/${accessToken}`;
}

/** URL absoluta del centro de descargas. */
export function buildDownloadCenterUrl(accessToken: string, baseUrl?: string): string {
  const base = (baseUrl ?? APP_URL).replace(/\/$/, "");
  return `${base}${getDownloadCenterPath(accessToken)}`;
}

/** URL directa al ZIP (secundaria; mantiene el flujo existente). */
export function buildZipDownloadApiUrl(accessToken: string, baseUrl?: string): string {
  const base = (baseUrl ?? APP_URL).replace(/\/$/, "");
  return `${base}/api/downloads/${accessToken}`;
}

/** URL de descarga individual por foto (API existente). */
export function buildPhotoDownloadApiUrl(photoToken: string, baseUrl?: string): string {
  const base = (baseUrl ?? APP_URL).replace(/\/$/, "");
  return `${base}/api/downloads/${photoToken}`;
}

/** Vista previa en grilla del centro de descargas. */
export function buildDownloadCenterPreviewPath(
  accessToken: string,
  photoId: number
): string {
  return `/api/descargas/${accessToken}/fotos/${photoId}/vista`;
}
