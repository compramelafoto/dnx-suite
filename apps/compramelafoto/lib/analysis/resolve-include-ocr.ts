function hasOcrProviderConfigured(): boolean {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim()) return true;
  // Fallback Amazon Rekognition DetectText
  return Boolean(
    process.env.AWS_REGION?.trim() &&
      process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
}

/**
 * OCR es opt-out con `?ocr=0`.
 * Por defecto se activa si hay Google Vision o AWS Rekognition configurado.
 */
export function resolveIncludeOcrFromRequest(url: URL): boolean {
  const param = url.searchParams.get("ocr");
  if (param === "0" || param === "false") return false;
  if (param === "1" || param === "true") return true;
  return hasOcrProviderConfigured();
}
