/**
 * Reglas del logo de un sponsor. Puro, para poder probarlo sin bucket.
 *
 * Son las mismas que el panel de Clickatón (`partner-logo-storage.ts`): el archivo termina en
 * el mismo lugar y lo sirve el mismo proxy, que sólo acepta esta forma de clave.
 */

export const SPONSOR_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
/** 4 MB: el pedido entero no puede pasar el `bodySizeLimit` de `next.config.ts`. */
export const SPONSOR_LOGO_MAX_BYTES = 4 * 1024 * 1024 - 64 * 1024;

const EXTENSION: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** `clickaton/partners/logos/AAAA-MM-DD/<uuid>.<ext>` — la forma que acepta `/api/media`. */
export const SPONSOR_LOGO_KEY_PATTERN =
  /^clickaton\/partners\/logos\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-z0-9-]+\.(png|jpe?g|webp)$/i;

export function validateSponsorLogo(input: { type: string; size: number }): { ok: true } | { ok: false; error: string } {
  const type = (input.type || "").toLowerCase();
  if (!(SPONSOR_LOGO_TYPES as readonly string[]).includes(type)) {
    // SVG queda afuera a propósito: puede llevar código adentro.
    return { ok: false, error: "El logo tiene que ser PNG, JPG o WebP." };
  }
  if (input.size <= 0) return { ok: false, error: "El archivo está vacío." };
  if (input.size > SPONSOR_LOGO_MAX_BYTES) return { ok: false, error: "El logo no puede pesar más de 4 MB." };
  return { ok: true };
}

export function extensionForSponsorLogo(mimeType: string): string {
  return EXTENSION[mimeType.toLowerCase()] ?? "png";
}

export function buildSponsorLogoKey(extension: string, now: Date, id: string): string {
  return `clickaton/partners/logos/${now.toISOString().slice(0, 10)}/${id.toLowerCase()}.${extension}`;
}
