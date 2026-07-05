/**
 * OCR (Google Vision) es opt-out con `?ocr=0`.
 * Por defecto se activa si hay credenciales de Vision configuradas.
 */
export function resolveIncludeOcrFromRequest(url: URL): boolean {
  const param = url.searchParams.get("ocr");
  if (param === "0" || param === "false") return false;
  if (param === "1" || param === "true") return true;
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim());
}
