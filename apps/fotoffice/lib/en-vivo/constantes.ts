/**
 * Transmisión en vivo: cualquier workspace transmite desde OBS a Cloudflare Stream, que graba
 * y retransmite a YouTube, Instagram y TikTok. Diseño:
 * `docs/superpowers/specs/2026-11-10-transmision-en-vivo.md`.
 *
 * Lo enciende FOTOFFICE (`platformFee`): cada minuto mirado o retransmitido cuesta en Cloudflare.
 */
export const LIVE_MODULE_KEY = "live";

export const LIVE_PATH = "/en-vivo";
export const LIVE_CONFIG_PATH = "/en-vivo/configurar";
export const LIVE_RECORDINGS_PATH = "/en-vivo/grabaciones";
export const LIVE_PORTAL_PATH = "/portal/en-vivo";
/** Segmento del sitio público: `/w/<slug>/en-vivo`. */
export const LIVE_PUBLIC_SEGMENT = "en-vivo";

/** Aviso cuando faltan las credenciales de Cloudflare Stream en la plataforma. */
export const AVISO_NO_HABILITADA = "La transmisión en vivo todavía no está habilitada en la plataforma.";
