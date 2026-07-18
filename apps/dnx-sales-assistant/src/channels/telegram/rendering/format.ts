const MAX_TELEGRAM_CHARS = 3900;

/** Escape HTML para parse_mode HTML de Telegram. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Segmenta mensajes largos sin cortar importes ni palabras a mitad.
 */
export function segmentTelegramText(
  text: string,
  maxChars = MAX_TELEGRAM_CHARS,
): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return [trimmed];

  const parts: string[] = [];
  let rest = trimmed;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf("\n\n", maxChars);
    if (cut < maxChars * 0.4) cut = rest.lastIndexOf("\n", maxChars);
    if (cut < maxChars * 0.4) cut = rest.lastIndexOf(" ", maxChars);
    if (cut < maxChars * 0.4) cut = maxChars;
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function formatMoney(currency: string, amount: number): string {
  const rounded = Math.round(amount);
  if (currency === "ARS") {
    return `$${rounded.toLocaleString("es-AR")}`;
  }
  return `${currency} ${rounded.toLocaleString("es-AR")}`;
}
