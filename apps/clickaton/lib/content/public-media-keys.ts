/**
 * Allowlist de claves servidas por el proxy público `/api/media/<key>`.
 *
 * Namespaces de marketing (`editions`, `products`), imágenes del blog
 * (`blog/hero`, `blog/media`), logos de sponsors, y (agregado para el correo
 * del diploma) la imagen ya emitida de un diploma de participación — todo
 * material que ya está destinado a mostrarse en público. Todo lo demás —
 * `clickaton/private/`, `welcome`, `profile`, y el resto de
 * `participant-cards` (welcome/member, y el PDF del diploma) — sigue con
 * proxies autenticados.
 *
 * Los logos de sponsors tienen dos formas por razones históricas:
 * - `partners/logos/<fecha>/<archivo>`: el namespace actual.
 * - `partners/<idDelSponsor>/brand/<fecha>/<archivo>`: el que usó la carga de
 *   agosto de 2026. Los 394 assets que hay en producción viven acá, así que sin
 *   esta rama el panel y las placas de agradecimiento los reciben con 404.
 * El segmento `brand` es el discriminante: `partners/<algo>/contratos/...` y
 * cualquier otro subnamespace del sponsor siguen fuera.
 *
 * El diploma es un caso distinto a los de arriba, así que tiene su propia
 * rama en vez de encajar en el patrón `<namespace>/<fecha>/<archivo>`:
 * - Sólo `participant-cards/.../diploma/.../*.png` — nunca `welcome/` ni
 *   `member/` (esas placas siguen privadas) y nunca `.pdf` (el PDF del
 *   diploma sigue sirviéndose autenticado desde Mi cuenta; el correo sólo
 *   necesita la imagen).
 * - No hace pública una carpeta entera: cada clave lleva el hash de
 *   render completo (`buildParticipantCardStorageKey`), así que no es
 *   adivinable ni lista contenido de otra persona por tanteo.
 * - Es correcto que sea pública: el diploma mismo ya es público por el QR
 *   impreso (cualquiera que lo escanea llega a `/diplomas/verificar/<token>`
 *   sin sesión) — esto sólo permite que la imagen se vea *dentro* de un
 *   cliente de correo, que tampoco tiene sesión.
 *
 * IMPORTANTE: este proxy es la única puerta pública que existe. `R2_PUBLIC_URL`
 * (si algún día se configura) NO debe usarse para esto — esa variable hace
 * público el bucket entero (credenciales con QR, fotos de perfil, contratos
 * de sponsors), no una clave puntual; por eso el chequeo de variables de
 * `r2-production-smoke` la excluye a propósito de la lista a verificar.
 */
export const PUBLIC_MEDIA_KEY_PATTERN =
  /^clickaton\/(?:(?:(?:editions|products)|blog\/(?:hero|media)|partners\/logos|partners\/[a-z0-9]+\/brand)\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-z0-9-]+\.[a-z0-9]+|participant-cards\/edition-[a-z0-9_-]+\/registration-[a-z0-9_-]+\/diploma\/v[0-9]+\/[a-z0-9_-]+\.png)$/i;

export function isPublicMediaKey(key: string): boolean {
  if (!key || key.includes("..")) return false;
  return PUBLIC_MEDIA_KEY_PATTERN.test(key);
}
