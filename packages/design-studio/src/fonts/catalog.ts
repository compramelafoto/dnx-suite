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
  "barlowCondensed",
] as const;

/** Las tipografías incrustadas en el paquete. */
export type CuratedFontId = (typeof FONT_IDS)[number];

/**
 * Cualquier otra familia de Google Fonts, por su nombre: `google:Montserrat`.
 *
 * El editor de plantillas ofrece unas sesenta familias de Google y el catálogo incrustado tiene
 * siete. Antes el resto se cambiaba en silencio por DM Sans y el PDF salía con otra letra que
 * la pantalla. Estas se bajan de Google al imprimir: del mismo lugar que las usa el editor.
 */
export type GoogleFontId = `google:${string}`;

export type FontId = CuratedFontId | GoogleFontId;

export const GOOGLE_FONT_PREFIX = "google:";

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

export const FONT_CATALOG: Record<CuratedFontId, FontDefinition> = {
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
  barlowCondensed: {
    label: "Barlow Condensed",
    cssFamily: "Barlow Condensed",
    fallbackStack: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
    pkg: "@fontsource/barlow-condensed",
    files: {
      normal: "barlow-condensed-latin-400-normal.woff",
      bold: "barlow-condensed-latin-700-normal.woff",
      italic: "barlow-condensed-latin-400-italic.woff",
      boldItalic: "barlow-condensed-latin-700-italic.woff",
    },
  },
};

export function isCuratedFontId(v: unknown): v is CuratedFontId {
  return typeof v === "string" && (FONT_IDS as readonly string[]).includes(v);
}

/** Nombre de familia de Google: letras, números y espacios. Nada que pueda torcer la URL. */
export function isGoogleFontId(v: unknown): v is GoogleFontId {
  if (typeof v !== "string" || !v.startsWith(GOOGLE_FONT_PREFIX)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9 ]{0,60}$/.test(v.slice(GOOGLE_FONT_PREFIX.length));
}

export function isFontId(v: unknown): v is FontId {
  return isCuratedFontId(v) || isGoogleFontId(v);
}

/** El nombre de familia de una tipografía de Google (`google:Lato` → `Lato`). */
export function googleFamilyOf(id: GoogleFontId): string {
  return id.slice(GOOGLE_FONT_PREFIX.length);
}

/** Nombre y familias CSS de cualquier tipografía, incrustada o de Google. */
export function fontDefinition(id: FontId): Pick<FontDefinition, "label" | "cssFamily" | "fallbackStack"> {
  if (isCuratedFontId(id)) return FONT_CATALOG[id];
  const familia = googleFamilyOf(id);
  return { label: familia, cssFamily: familia, fallbackStack: `'${familia}', 'DM Sans', Arial, sans-serif` };
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
