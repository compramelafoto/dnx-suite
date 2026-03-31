/**
 * Fuentes disponibles para bloques de texto de diplomas (preview HTML + export PDF).
 * Los binarios PDF se resuelven vía @fontsource/* (WOFF) en renderDiploma.
 * Preview: Google Fonts en `app/layout.tsx` + stacks CSS coherentes.
 */

export const DIPLOMA_FONT_IDS = [
  /* Sans */
  "dmSans",
  "inter",
  "outfit",
  "manrope",
  "plusJakartaSans",
  /* Serif */
  "playfairDisplay",
  "merriweather",
  "lora",
  "cinzel",
  "sourceSerif4",
  "libreBaskerville",
  "cormorantGaramond",
  "ebGaramond",
  "spectral",
  /* Script / caligráficas */
  "dancingScript",
  "greatVibes",
  "allura",
  "satisfy",
  /* Manuscritas */
  "caveat",
  /* Firma / trazo fino */
  "sacramento",
] as const;

export type DiplomaFontId = (typeof DIPLOMA_FONT_IDS)[number];

export const DEFAULT_DIPLOMA_FONT_ID: DiplomaFontId = "dmSans";

/** Agrupación para el selector del editor (orden de secciones en UI). */
export type DiplomaFontCategoryId =
  | "sans"
  | "serif"
  | "script"
  | "handwritten"
  | "signature";

export const DIPLOMA_FONT_CATEGORY_LABELS: Record<DiplomaFontCategoryId, string> = {
  sans: "Sans — modernas y limpias",
  serif: "Serif — elegantes e institucionales",
  script: "Script — caligráficas y decorativas",
  handwritten: "Manuscritas — gesto natural",
  signature: "Firma — trazo fino tipo rúbrica",
};

export type DiplomaFontOption = {
  id: DiplomaFontId;
  category: DiplomaFontCategoryId;
  /** Nombre en UI */
  label: string;
  /** Subtítulo / uso sugerido */
  hint: string;
  /** Texto mostrado en preview del desplegable */
  previewText: string;
  /** stack CSS (coincide con Google Fonts en layout) */
  cssStack: string;
};

export const DIPLOMA_FONT_OPTIONS: DiplomaFontOption[] = [
  // —— Sans ——
  {
    id: "dmSans",
    category: "sans",
    label: "DM Sans",
    hint: "Neutra, muy legible",
    previewText: "Texto de cuerpo",
    cssStack: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "inter",
    category: "sans",
    label: "Inter",
    hint: "UI clara, datos",
    previewText: "Códigos y detalle",
    cssStack: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "outfit",
    category: "sans",
    label: "Outfit",
    hint: "Geométrica contemporánea",
    previewText: "Títulos modernos",
    cssStack: '"Outfit", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "manrope",
    category: "sans",
    label: "Manrope",
    hint: "Redondeada, premium tech",
    previewText: "Bloques actuales",
    cssStack: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "plusJakartaSans",
    category: "sans",
    label: "Plus Jakarta Sans",
    hint: "Startups, workshops",
    previewText: "Certificados frescos",
    cssStack: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  },
  // —— Serif ——
  {
    id: "playfairDisplay",
    category: "serif",
    label: "Playfair Display",
    hint: "Gala, alto contraste",
    previewText: "Premio mayor",
    cssStack: '"Playfair Display", Georgia, "Times New Roman", serif',
  },
  {
    id: "merriweather",
    category: "serif",
    label: "Merriweather",
    hint: "Lectura seria en pantalla",
    previewText: "Cuerpo institucional",
    cssStack: '"Merriweather", Georgia, serif',
  },
  {
    id: "lora",
    category: "serif",
    label: "Lora",
    hint: "Editorial cálida",
    previewText: "Párrafos elegantes",
    cssStack: '"Lora", Georgia, serif',
  },
  {
    id: "cinzel",
    category: "serif",
    label: "Cinzel",
    hint: "Rótulos clásicos, caps",
    previewText: "DIPLOMA · MENCIÓN",
    cssStack: '"Cinzel", "Times New Roman", serif',
  },
  {
    id: "sourceSerif4",
    category: "serif",
    label: "Source Serif 4",
    hint: "Institucional sobria",
    previewText: "Texto académico",
    cssStack: '"Source Serif 4", Georgia, serif',
  },
  {
    id: "libreBaskerville",
    category: "serif",
    label: "Libre Baskerville",
    hint: "Impresión clásica",
    previewText: "Estilo libro",
    cssStack: '"Libre Baskerville", Georgia, serif',
  },
  {
    id: "cormorantGaramond",
    category: "serif",
    label: "Cormorant Garamond",
    hint: "Elegancia fina, moda",
    previewText: "Títulos delicados",
    cssStack: '"Cormorant Garamond", "Times New Roman", serif',
  },
  {
    id: "ebGaramond",
    category: "serif",
    label: "EB Garamond",
    hint: "Renacentista, premium",
    previewText: "Documento de mérito",
    cssStack: '"EB Garamond", "Times New Roman", serif',
  },
  {
    id: "spectral",
    category: "serif",
    label: "Spectral",
    hint: "Literaria, longform",
    previewText: "Narrativa editorial",
    cssStack: '"Spectral", Georgia, serif',
  },
  // —— Script ——
  {
    id: "dancingScript",
    category: "script",
    label: "Dancing Script",
    hint: "Fluida, celebración",
    previewText: "Mención especial",
    cssStack: '"Dancing Script", "Brush Script MT", cursive',
  },
  {
    id: "greatVibes",
    category: "script",
    label: "Great Vibes",
    hint: "Formal festiva",
    previewText: "Galardón elegante",
    cssStack: '"Great Vibes", "Brush Script MT", cursive',
  },
  {
    id: "allura",
    category: "script",
    label: "Allura",
    hint: "Invitación, arte",
    previewText: "Exposición seleccionada",
    cssStack: '"Allura", "Brush Script MT", cursive',
  },
  {
    id: "satisfy",
    category: "script",
    label: "Satisfy",
    hint: "Pincel suave",
    previewText: "Destacado creativo",
    cssStack: '"Satisfy", "Brush Script MT", cursive',
  },
  // —— Handwritten ——
  {
    id: "caveat",
    category: "handwritten",
    label: "Caveat",
    hint: "Manuscrita legible",
    previewText: "Nota personal",
    cssStack: '"Caveat", "Segoe Script", cursive',
  },
  // —— Signature ——
  {
    id: "sacramento",
    category: "signature",
    label: "Sacramento",
    hint: "Rúbrica fina, firma",
    previewText: "Nombre · firma",
    cssStack: '"Sacramento", "Segoe Script", cursive',
  },
];

/** Orden fijo de categorías en el desplegable. */
export const DIPLOMA_FONT_CATEGORY_ORDER: DiplomaFontCategoryId[] = [
  "sans",
  "serif",
  "script",
  "handwritten",
  "signature",
];

export function isDiplomaFontId(s: unknown): s is DiplomaFontId {
  return typeof s === "string" && (DIPLOMA_FONT_IDS as readonly string[]).includes(s);
}

export function normalizeDiplomaFontId(s: unknown): DiplomaFontId {
  return isDiplomaFontId(s) ? s : DEFAULT_DIPLOMA_FONT_ID;
}

export function diplomaFontCssStack(id: unknown): string {
  const fid = normalizeDiplomaFontId(id);
  const opt = DIPLOMA_FONT_OPTIONS.find((o) => o.id === fid);
  return opt?.cssStack ?? DIPLOMA_FONT_OPTIONS[0]!.cssStack;
}

/** Presets coherentes para plantillas públicas (título / destinatario / cuerpo / premio). */
export type DiplomaFontPresetKey =
  | "default"
  | "galaSerif"
  | "institutional"
  | "modernSans"
  | "editorial"
  | "minimal"
  | "photo"
  | "classicPrint";

export const DIPLOMA_FONT_PRESETS: Record<
  DiplomaFontPresetKey,
  { title: DiplomaFontId; recipient: DiplomaFontId; body: DiplomaFontId; prize: DiplomaFontId }
> = {
  default: {
    title: "dmSans",
    recipient: "dmSans",
    body: "dmSans",
    prize: "dmSans",
  },
  galaSerif: {
    title: "playfairDisplay",
    recipient: "cormorantGaramond",
    body: "lora",
    prize: "cinzel",
  },
  institutional: {
    title: "sourceSerif4",
    recipient: "sourceSerif4",
    body: "merriweather",
    prize: "cinzel",
  },
  modernSans: {
    title: "outfit",
    recipient: "dmSans",
    body: "inter",
    prize: "outfit",
  },
  editorial: {
    title: "playfairDisplay",
    recipient: "lora",
    body: "merriweather",
    prize: "cinzel",
  },
  minimal: {
    title: "inter",
    recipient: "inter",
    body: "inter",
    prize: "dmSans",
  },
  photo: {
    title: "cormorantGaramond",
    recipient: "dmSans",
    body: "lora",
    prize: "cinzel",
  },
  classicPrint: {
    title: "libreBaskerville",
    recipient: "libreBaskerville",
    body: "lora",
    prize: "cinzel",
  },
};
