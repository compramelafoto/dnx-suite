/**
 * Allowlist de tipografías para preview V1.
 * No se descargan fuentes desde URLs del cliente.
 */

export const TEMPLATE_V2_PREVIEW_ALLOWED_FONTS: Record<string, string> = {
  Helvetica: 'Helvetica, Arial, "Helvetica Neue", sans-serif',
  Arial: 'Arial, Helvetica, sans-serif',
  "DM Sans": '"DM Sans", Helvetica, Arial, sans-serif',
  "Barlow Condensed": '"Barlow Condensed", "Arial Narrow", Helvetica, Arial, sans-serif',
  Inter: 'Inter, Helvetica, Arial, sans-serif',
  "Times New Roman": '"Times New Roman", Times, serif',
  Georgia: "Georgia, Times, serif",
  "Courier New": '"Courier New", Courier, monospace',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export type FontResolveResult = {
  cssFamily: string;
  requested: string;
  fallbackUsed: boolean;
};

export function resolvePreviewFontFamily(requested: unknown): FontResolveResult {
  const raw = typeof requested === "string" && requested.trim() ? requested.trim() : "Helvetica";
  const key = Object.keys(TEMPLATE_V2_PREVIEW_ALLOWED_FONTS).find(
    (k) => k.toLowerCase() === raw.toLowerCase()
  );
  if (key) {
    return {
      cssFamily: TEMPLATE_V2_PREVIEW_ALLOWED_FONTS[key]!,
      requested: raw,
      fallbackUsed: false,
    };
  }
  // Sanitizar: solo letras/números/espacios/guiones; stack seguro
  const safe = raw.replace(/[^a-zA-Z0-9 \-_]/g, "").slice(0, 64) || "Helvetica";
  return {
    cssFamily: `"${safe}", Helvetica, Arial, sans-serif`,
    requested: raw,
    fallbackUsed: true,
  };
}

/** CSS @font-face vacío en V1 — solo stacks del sistema / web-safe. */
export function buildPreviewFontFaceCss(): string {
  return `/* Preview V1: system / allowlisted stacks only */\n`;
}
