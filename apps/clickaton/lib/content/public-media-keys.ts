/**
 * Allowlist de claves servidas por el proxy público `/api/media/<key>`.
 *
 * Namespaces de marketing (`editions`, `products`), imágenes del blog
 * (`blog/hero`, `blog/media`) y logos de sponsors, que son material de marca
 * destinado a mostrarse en público. Todo lo demás — `clickaton/private/`,
 * `welcome`, `profile`, `participant-cards` — tiene proxies autenticados.
 *
 * Los logos de sponsors tienen dos formas por razones históricas:
 * - `partners/logos/<fecha>/<archivo>`: el namespace actual.
 * - `partners/<idDelSponsor>/brand/<fecha>/<archivo>`: el que usó la carga de
 *   agosto de 2026. Los 394 assets que hay en producción viven acá, así que sin
 *   esta rama el panel y las placas de agradecimiento los reciben con 404.
 * El segmento `brand` es el discriminante: `partners/<algo>/contratos/...` y
 * cualquier otro subnamespace del sponsor siguen fuera.
 */
export const PUBLIC_MEDIA_KEY_PATTERN =
  /^clickaton\/(?:(?:editions|products)|blog\/(?:hero|media)|partners\/logos|partners\/[a-z0-9]+\/brand)\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-z0-9-]+\.[a-z0-9]+$/i;

export function isPublicMediaKey(key: string): boolean {
  if (!key || key.includes("..")) return false;
  return PUBLIC_MEDIA_KEY_PATTERN.test(key);
}
