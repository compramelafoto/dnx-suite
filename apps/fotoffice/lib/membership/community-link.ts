/**
 * El enlace al grupo de WhatsApp de los socios. Módulo PURO: sin base y sin red.
 *
 * Sólo se acepta un enlace de invitación a un grupo (`https://chat.whatsapp.com/<código>`):
 * va en un botón que reciben todos los socios, y un campo libre convertiría ese botón en una
 * forma de mandarlos a cualquier sitio.
 */

const GRUPO = /^https:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]{10,40})\/?$/;

export type CommunityLinkResult = { ok: true; value: string | null } | { ok: false; error: string };

export function parseWhatsappGroupUrl(raw: unknown): CommunityLinkResult {
  const texto = String(raw ?? "").trim();
  if (texto === "") return { ok: true, value: null };
  // Se acepta sin "https://" porque así lo copia más de uno desde el teléfono.
  const conProtocolo = /^chat\.whatsapp\.com\//i.test(texto) ? `https://${texto}` : texto;
  const m = GRUPO.exec(conProtocolo.replace(/^https:\/\/chat\.whatsapp\.com/i, "https://chat.whatsapp.com"));
  if (!m) {
    return {
      ok: false,
      error: "Pegá el enlace de invitación del grupo: empieza con https://chat.whatsapp.com/",
    };
  }
  return { ok: true, value: `https://chat.whatsapp.com/${m[1]}` };
}

/** Lo que ya está guardado, releído con la misma regla: si no la cumple, no se muestra. */
export function safeWhatsappGroupUrl(stored: string | null | undefined): string | null {
  const r = parseWhatsappGroupUrl(stored);
  return r.ok ? r.value : null;
}
