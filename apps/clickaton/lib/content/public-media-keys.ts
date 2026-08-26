/**
 * Allowlist de claves servidas por el proxy público `/api/media/<key>`.
 *
 * Namespaces de marketing (`editions`, `products`), imágenes del blog
 * (`blog/hero`, `blog/media`) y logos de sponsors (`partners/logos`), que son
 * material de marca destinado a mostrarse en público. Todo lo demás —
 * `clickaton/private/`, `welcome`, `profile`, `participant-cards` — tiene
 * proxies autenticados.
 */
export const PUBLIC_MEDIA_KEY_PATTERN =
  /^clickaton\/(?:(?:editions|products)|blog\/(?:hero|media)|partners\/logos)\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-z0-9-]+\.[a-z0-9]+$/i;

export function isPublicMediaKey(key: string): boolean {
  if (!key || key.includes("..")) return false;
  return PUBLIC_MEDIA_KEY_PATTERN.test(key);
}
