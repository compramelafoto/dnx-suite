/**
 * Catálogo de fuentes para el editor de plantillas (Google Fonts).
 * `family` es el nombre que se guarda en configJson.fontFamily y se usa en CSS.
 */

export type EditorFontCategory = "Sans" | "Serif" | "Display" | "Script" | "Handwriting" | "Mono";

export type EditorFontEntry = {
  /** id estable para keys */
  id: string;
  /** Nombre visible */
  label: string;
  /** Valor en config (nombre de familia CSS) */
  family: string;
  category: EditorFontCategory;
};

/** Etiquetas en el desplegable de fuentes (barra de formato). */
export const EDITOR_FONT_CATEGORY_LABELS: Record<EditorFontCategory, string> = {
  Sans: "Sans serif",
  Serif: "Serif",
  Display: "Display",
  Mono: "Monoespacio",
  Script: "Caligrafía",
  Handwriting: "A mano alzada",
};

export const EDITOR_FONT_CATALOG: EditorFontEntry[] = [
  { id: "inter", label: "Inter", family: "Inter", category: "Sans" },
  { id: "roboto", label: "Roboto", family: "Roboto", category: "Sans" },
  { id: "open-sans", label: "Open Sans", family: "Open Sans", category: "Sans" },
  { id: "lato", label: "Lato", family: "Lato", category: "Sans" },
  { id: "montserrat", label: "Montserrat", family: "Montserrat", category: "Sans" },
  { id: "poppins", label: "Poppins", family: "Poppins", category: "Sans" },
  { id: "raleway", label: "Raleway", family: "Raleway", category: "Sans" },
  { id: "nunito", label: "Nunito", family: "Nunito", category: "Sans" },
  { id: "work-sans", label: "Work Sans", family: "Work Sans", category: "Sans" },
  { id: "dm-sans", label: "DM Sans", family: "DM Sans", category: "Sans" },
  { id: "manrope", label: "Manrope", family: "Manrope", category: "Sans" },
  { id: "ubuntu", label: "Ubuntu", family: "Ubuntu", category: "Sans" },
  { id: "noto-sans", label: "Noto Sans", family: "Noto Sans", category: "Sans" },
  { id: "rubik", label: "Rubik", family: "Rubik", category: "Sans" },
  { id: "quicksand", label: "Quicksand", family: "Quicksand", category: "Sans" },
  { id: "merriweather", label: "Merriweather", family: "Merriweather", category: "Serif" },
  { id: "playfair", label: "Playfair Display", family: "Playfair Display", category: "Serif" },
  { id: "lora", label: "Lora", family: "Lora", category: "Serif" },
  { id: "source-serif", label: "Source Serif 4", family: "Source Serif 4", category: "Serif" },
  { id: "crimson", label: "Crimson Text", family: "Crimson Text", category: "Serif" },
  { id: "libre-baskerville", label: "Libre Baskerville", family: "Libre Baskerville", category: "Serif" },
  { id: "oswald", label: "Oswald", family: "Oswald", category: "Display" },
  { id: "bebas", label: "Bebas Neue", family: "Bebas Neue", category: "Display" },
  { id: "anton", label: "Anton", family: "Anton", category: "Display" },
  { id: "jetbrains-mono", label: "JetBrains Mono", family: "JetBrains Mono", category: "Mono" },
  { id: "fira-code", label: "Fira Code", family: "Fira Code", category: "Mono" },
  { id: "ibm-plex-mono", label: "IBM Plex Mono", family: "IBM Plex Mono", category: "Mono" },
  { id: "great-vibes", label: "Great Vibes", family: "Great Vibes", category: "Script" },
  { id: "sacramento", label: "Sacramento", family: "Sacramento", category: "Script" },
  { id: "allura", label: "Allura", family: "Allura", category: "Script" },
  { id: "satisfy", label: "Satisfy", family: "Satisfy", category: "Script" },
  { id: "tangerine", label: "Tangerine", family: "Tangerine", category: "Script" },
  { id: "parisienne", label: "Parisienne", family: "Parisienne", category: "Script" },
  { id: "alex-brush", label: "Alex Brush", family: "Alex Brush", category: "Script" },
  { id: "dancing", label: "Dancing Script", family: "Dancing Script", category: "Handwriting" },
  { id: "pacifico", label: "Pacifico", family: "Pacifico", category: "Handwriting" },
  { id: "caveat", label: "Caveat", family: "Caveat", category: "Handwriting" },
  { id: "kalam", label: "Kalam", family: "Kalam", category: "Handwriting" },
  { id: "permanent-marker", label: "Permanent Marker", family: "Permanent Marker", category: "Handwriting" },
  { id: "shadows-into-light", label: "Shadows Into Light", family: "Shadows Into Light", category: "Handwriting" },
  { id: "architects-daughter", label: "Architects Daughter", family: "Architects Daughter", category: "Handwriting" },
  { id: "indie-flower", label: "Indie Flower", family: "Indie Flower", category: "Handwriting" },
  { id: "homemade-apple", label: "Homemade Apple", family: "Homemade Apple", category: "Handwriting" },
  { id: "patrick-hand", label: "Patrick Hand", family: "Patrick Hand", category: "Handwriting" },
  { id: "reenie-beanie", label: "Reenie Beanie", family: "Reenie Beanie", category: "Handwriting" },
  { id: "rock-salt", label: "Rock Salt", family: "Rock Salt", category: "Handwriting" },
  { id: "gloria-hallelujah", label: "Gloria Hallelujah", family: "Gloria Hallelujah", category: "Handwriting" },
  { id: "schoolbell", label: "Schoolbell", family: "Schoolbell", category: "Handwriting" },
  { id: "give-you-glory", label: "Give You Glory", family: "Give You Glory", category: "Handwriting" },
  { id: "nothing-you-could-do", label: "Nothing You Could Do", family: "Nothing You Could Do", category: "Handwriting" },
  { id: "covered-by-your-grace", label: "Covered By Your Grace", family: "Covered By Your Grace", category: "Handwriting" },
  { id: "amatic-sc", label: "Amatic SC", family: "Amatic SC", category: "Handwriting" },
  { id: "just-another-hand", label: "Just Another Hand", family: "Just Another Hand", category: "Handwriting" },
  { id: "handlee", label: "Handlee", family: "Handlee", category: "Handwriting" },
  { id: "courgette", label: "Courgette", family: "Courgette", category: "Handwriting" },
  { id: "bad-script", label: "Bad Script", family: "Bad Script", category: "Handwriting" },
  { id: "marck-script", label: "Marck Script", family: "Marck Script", category: "Handwriting" },
  /** Fallback sistema (no requiere Google) */
  { id: "helvetica", label: "Helvetica (sistema)", family: "Helvetica", category: "Sans" },
  { id: "georgia", label: "Georgia (sistema)", family: "Georgia", category: "Serif" },
  { id: "times", label: "Times New Roman (sistema)", family: "Times New Roman", category: "Serif" },
];

const SYSTEM_FONT_IDS = new Set(["helvetica", "georgia", "times"]);

/**
 * Ejes pedidos a Google Fonts CSS2. Antes solo 400/700: los bloques usan 500–800 y el navegador
 * caía en síntesis o genérica; además faltaba font-src en CSP → gstatic bloqueado.
 * Google ignora combinaciones que una familia no tenga (p. ej. script solo 400).
 */
const GOOGLE_FONT_ITAL_WGHT_AXIS =
  "ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,900";

/** Una o más URLs CSS2 (trozos) para no superar límites de longitud del navegador. */
export function buildEditorGoogleFontsStylesheetHrefs(): string[] {
  const googleOnly = EDITOR_FONT_CATALOG.filter((f) => !SYSTEM_FONT_IDS.has(f.id));
  const chunkSize = 8;
  const hrefs: string[] = [];
  for (let i = 0; i < googleOnly.length; i += chunkSize) {
    const slice = googleOnly.slice(i, i + chunkSize);
    const parts = slice.map((f) => {
      const name = f.family.replace(/ /g, "+");
      return `family=${name}:${GOOGLE_FONT_ITAL_WGHT_AXIS}`;
    });
    hrefs.push(`https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`);
  }
  return hrefs;
}

export function findEditorFontEntry(family: string): EditorFontEntry | undefined {
  const t = family.trim();
  return EDITOR_FONT_CATALOG.find((f) => f.family === t);
}
