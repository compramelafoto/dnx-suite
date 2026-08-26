/**
 * Catálogo cerrado de tipografías.
 *
 * Los identificadores coinciden con los de fotorank para que la migración de diplomas sea
 * una correspondencia directa y no una tabla de traducción.
 *
 * Las fuentes de un solo peso reutilizan el archivo de 400 en todas las variantes: es lo que
 * hay, y es preferible a un fallback silencioso a otra familia.
 */

export const FONT_IDS = [
  "dmSans",
  "inter",
  "playfairDisplay",
  "merriweather",
  "cinzel",
  "greatVibes",
] as const;

export type FontId = (typeof FONT_IDS)[number];

export type FontSlot = "normal" | "bold" | "italic" | "boldItalic";

export type FontDefinition = {
  /** Nombre para la persona que diseña. */
  label: string;
  /** Familia CSS, para la vista de pantalla. */
  cssFamily: string;
  /** Alternativa declarada si la familia no carga en el navegador. */
  fallbackStack: string;
  /** Paquete de npm que trae los binarios. */
  pkg: string;
  files: Record<FontSlot, string>;
};

export const FONT_CATALOG: Record<FontId, FontDefinition> = {
  dmSans: {
    label: "DM Sans",
    cssFamily: "DM Sans",
    fallbackStack: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    pkg: "@fontsource/dm-sans",
    files: {
      normal: "dm-sans-latin-400-normal.woff",
      bold: "dm-sans-latin-700-normal.woff",
      italic: "dm-sans-latin-400-italic.woff",
      boldItalic: "dm-sans-latin-700-italic.woff",
    },
  },
  inter: {
    label: "Inter",
    cssFamily: "Inter",
    fallbackStack: "Inter, 'Helvetica Neue', Arial, sans-serif",
    pkg: "@fontsource/inter",
    files: {
      normal: "inter-latin-400-normal.woff",
      bold: "inter-latin-700-normal.woff",
      italic: "inter-latin-400-italic.woff",
      boldItalic: "inter-latin-700-italic.woff",
    },
  },
  playfairDisplay: {
    label: "Playfair Display",
    cssFamily: "Playfair Display",
    fallbackStack: "'Playfair Display', Georgia, 'Times New Roman', serif",
    pkg: "@fontsource/playfair-display",
    files: {
      normal: "playfair-display-latin-400-normal.woff",
      bold: "playfair-display-latin-700-normal.woff",
      italic: "playfair-display-latin-400-italic.woff",
      boldItalic: "playfair-display-latin-700-italic.woff",
    },
  },
  merriweather: {
    label: "Merriweather",
    cssFamily: "Merriweather",
    fallbackStack: "Merriweather, Georgia, 'Times New Roman', serif",
    pkg: "@fontsource/merriweather",
    files: {
      normal: "merriweather-latin-400-normal.woff",
      bold: "merriweather-latin-700-normal.woff",
      italic: "merriweather-latin-400-italic.woff",
      boldItalic: "merriweather-latin-700-italic.woff",
    },
  },
  cinzel: {
    label: "Cinzel",
    cssFamily: "Cinzel",
    fallbackStack: "Cinzel, Georgia, 'Times New Roman', serif",
    pkg: "@fontsource/cinzel",
    files: {
      // Cinzel no trae cursiva: la variante reutiliza el archivo recto a propósito.
      normal: "cinzel-latin-400-normal.woff",
      bold: "cinzel-latin-700-normal.woff",
      italic: "cinzel-latin-400-normal.woff",
      boldItalic: "cinzel-latin-700-normal.woff",
    },
  },
  greatVibes: {
    label: "Great Vibes",
    cssFamily: "Great Vibes",
    fallbackStack: "'Great Vibes', 'Brush Script MT', cursive",
    pkg: "@fontsource/great-vibes",
    files: {
      // Un solo peso disponible: las cuatro variantes son el mismo archivo.
      normal: "great-vibes-latin-400-normal.woff",
      bold: "great-vibes-latin-400-normal.woff",
      italic: "great-vibes-latin-400-normal.woff",
      boldItalic: "great-vibes-latin-400-normal.woff",
    },
  },
};

export function isFontId(v: unknown): v is FontId {
  return typeof v === "string" && (FONT_IDS as readonly string[]).includes(v);
}

export function slotFor(
  weight: "normal" | "bold" | undefined,
  style: "normal" | "italic" | undefined,
): FontSlot {
  const negrita = weight === "bold";
  const cursiva = style === "italic";
  if (negrita && cursiva) return "boldItalic";
  if (negrita) return "bold";
  if (cursiva) return "italic";
  return "normal";
}
