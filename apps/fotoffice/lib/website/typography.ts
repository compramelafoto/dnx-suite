import type { CSSProperties } from "react";
import { z } from "zod";

/**
 * Tipografía por niveles del sitio público: cada nivel de texto (título principal, títulos de
 * sección, subtítulos, texto, botones, menú) tiene su letra, tamaño, grosor, color y mayúsculas.
 *
 * Cómo se guarda: el "estilo de partida" (`typographyPreset`, los 5 de siempre) define la base de
 * todos los niveles, y `typographyLevels` guarda SÓLO lo que el dueño cambió encima. Así un
 * sitio publicado antes de esto (sin `typographyLevels`) se ve igual que antes, y elegir otro
 * estilo de partida es borrar los cambios y empezar de esa base.
 *
 * Todo es controlado (nunca CSS libre): letras de un catálogo cerrado, tamaños en pasos, colores
 * de la paleta del sitio o un hex validado. Lo que sale de acá termina en el HTML público.
 *
 * Este archivo no importa `design-presets.ts` (que sí lo importa a él) para no armar un ciclo:
 * por eso las bases por estilo viven acá, con la clave del estilo como texto.
 */

// ── Catálogo de letras ────────────────────────────────────────────────────────────────────

export type FontCategory = "serif" | "sans" | "display";

export type FontOption = {
  id: string;
  label: string;
  category: FontCategory;
  /** Valor de `font-family`, con su respaldo. */
  stack: string;
  /** Nombre en Google Fonts; `null` = letra del sistema, no se descarga nada. */
  google: string | null;
  /** Grosores que trae la letra. Las del sistema los simulan todos. */
  weights: readonly number[];
};

const TODOS = [300, 400, 500, 600, 700, 800] as const;
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const FONT_OPTIONS: readonly FontOption[] = [
  // Del sistema: son las que usaban los 5 estilos de partida. No se descargan.
  { id: "system-serif", label: "Georgia (sistema)", category: "serif", stack: SERIF, google: null, weights: TODOS },
  { id: "system-sans", label: "Sans del sistema", category: "sans", stack: SANS, google: null, weights: TODOS },
  { id: "helvetica", label: "Helvetica (sistema)", category: "sans", stack: "'Helvetica Neue', Arial, sans-serif", google: null, weights: TODOS },
  // Google Fonts, con serifa.
  { id: "playfair-display", label: "Playfair Display", category: "serif", stack: `'Playfair Display', ${SERIF}`, google: "Playfair Display", weights: [400, 500, 600, 700, 800] },
  { id: "lora", label: "Lora", category: "serif", stack: `'Lora', ${SERIF}`, google: "Lora", weights: [400, 500, 600, 700] },
  { id: "merriweather", label: "Merriweather", category: "serif", stack: `'Merriweather', ${SERIF}`, google: "Merriweather", weights: [300, 400, 700] },
  { id: "cormorant-garamond", label: "Cormorant Garamond", category: "serif", stack: `'Cormorant Garamond', ${SERIF}`, google: "Cormorant Garamond", weights: [300, 400, 500, 600, 700] },
  { id: "libre-baskerville", label: "Libre Baskerville", category: "serif", stack: `'Libre Baskerville', ${SERIF}`, google: "Libre Baskerville", weights: [400, 700] },
  // Google Fonts, sin serifa.
  { id: "montserrat", label: "Montserrat", category: "sans", stack: `'Montserrat', ${SANS}`, google: "Montserrat", weights: TODOS },
  { id: "poppins", label: "Poppins", category: "sans", stack: `'Poppins', ${SANS}`, google: "Poppins", weights: TODOS },
  { id: "inter", label: "Inter", category: "sans", stack: `'Inter', ${SANS}`, google: "Inter", weights: TODOS },
  { id: "raleway", label: "Raleway", category: "sans", stack: `'Raleway', ${SANS}`, google: "Raleway", weights: TODOS },
  { id: "lato", label: "Lato", category: "sans", stack: `'Lato', ${SANS}`, google: "Lato", weights: [300, 400, 700] },
  { id: "open-sans", label: "Open Sans", category: "sans", stack: `'Open Sans', ${SANS}`, google: "Open Sans", weights: TODOS },
  { id: "nunito", label: "Nunito", category: "sans", stack: `'Nunito', ${SANS}`, google: "Nunito", weights: TODOS },
  { id: "work-sans", label: "Work Sans", category: "sans", stack: `'Work Sans', ${SANS}`, google: "Work Sans", weights: TODOS },
  { id: "josefin-sans", label: "Josefin Sans", category: "sans", stack: `'Josefin Sans', ${SANS}`, google: "Josefin Sans", weights: [300, 400, 500, 600, 700] },
  // Google Fonts, de exhibición (para títulos).
  { id: "dm-serif-display", label: "DM Serif Display", category: "display", stack: `'DM Serif Display', ${SERIF}`, google: "DM Serif Display", weights: [400] },
  { id: "oswald", label: "Oswald", category: "display", stack: `'Oswald', ${SANS}`, google: "Oswald", weights: [300, 400, 500, 600, 700] },
  { id: "bebas-neue", label: "Bebas Neue", category: "display", stack: `'Bebas Neue', ${SANS}`, google: "Bebas Neue", weights: [400] },
  { id: "dancing-script", label: "Dancing Script", category: "display", stack: `'Dancing Script', cursive`, google: "Dancing Script", weights: [400, 500, 600, 700] },
];

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  serif: "Con serifa",
  sans: "Sin serifa",
  display: "Para títulos",
};

const FONT_IDS = FONT_OPTIONS.map((f) => f.id) as [string, ...string[]];

export function getFont(id: string): FontOption {
  return FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[1];
}

/** El grosor disponible más cercano: una letra que sólo trae 400 no puede ir en 700. */
export function nearestWeight(font: FontOption, weight: number): number {
  return font.weights.reduce((mejor, w) => (Math.abs(w - weight) < Math.abs(mejor - weight) ? w : mejor), font.weights[0]);
}

export const WEIGHT_LABELS: Record<number, string> = {
  300: "Fina",
  400: "Normal",
  500: "Media",
  600: "Semi negrita",
  700: "Negrita",
  800: "Extra negrita",
};

// ── Niveles ───────────────────────────────────────────────────────────────────────────────

export const TYPOGRAPHY_LEVELS = [
  { id: "title", label: "Título principal", description: "El título grande de la portada.", sample: "Bienvenidos" },
  { id: "heading", label: "Títulos de sección", description: "El título de cada sección.", sample: "Quiénes somos" },
  { id: "subtitle", label: "Subtítulos", description: "El texto bajo el título de la portada.", sample: "Fotografía con historia" },
  { id: "body", label: "Texto", description: "Los párrafos.", sample: "Un texto de ejemplo para ver cómo se lee." },
  { id: "button", label: "Botones", description: "El texto de los botones.", sample: "Quiero sumarme" },
  { id: "menu", label: "Menú", description: "Los ítems del menú.", sample: "Inicio · Cursos · Contacto" },
] as const;
export type TypographyLevelId = (typeof TYPOGRAPHY_LEVELS)[number]["id"];
const LEVEL_IDS = TYPOGRAPHY_LEVELS.map((l) => l.id) as [TypographyLevelId, ...TypographyLevelId[]];

export const SIZE_STEPS = [
  { id: "sm", label: "Chico" },
  { id: "md", label: "Mediano" },
  { id: "lg", label: "Grande" },
  { id: "xl", label: "Muy grande" },
] as const;
export type SizeStepId = (typeof SIZE_STEPS)[number]["id"];
const SIZE_IDS = SIZE_STEPS.map((s) => s.id) as [SizeStepId, ...SizeStepId[]];

/**
 * Tamaño de cada paso por nivel. Los títulos se adaptan al ancho con `cqi` (ancho del marco del
 * sitio, ver `SiteFrame`) y no de la ventana: así la vista previa en modo celular se ve como en
 * un celular. "Mediano" es el tamaño que tenía cada nivel antes de que se pudiera elegir.
 */
const SIZES: Record<TypographyLevelId, Record<SizeStepId, string>> = {
  title: {
    sm: "clamp(1.625rem, 1rem + 3cqi, 2.25rem)",
    md: "clamp(1.875rem, 1rem + 4.5cqi, 3rem)",
    lg: "clamp(2.25rem, 1rem + 6cqi, 3.75rem)",
    xl: "clamp(2.5rem, 1rem + 8cqi, 4.5rem)",
  },
  heading: {
    sm: "1.25rem",
    md: "clamp(1.5rem, 1.25rem + 1cqi, 1.875rem)",
    lg: "clamp(1.75rem, 1.25rem + 2cqi, 2.25rem)",
    xl: "clamp(2rem, 1.25rem + 3cqi, 3rem)",
  },
  subtitle: {
    sm: "1rem",
    md: "clamp(1.125rem, 1rem + 0.5cqi, 1.25rem)",
    lg: "clamp(1.25rem, 1rem + 1cqi, 1.5rem)",
    xl: "clamp(1.375rem, 1rem + 1.5cqi, 1.875rem)",
  },
  body: { sm: "0.9375rem", md: "1rem", lg: "1.125rem", xl: "1.25rem" },
  button: { sm: "0.8125rem", md: "0.875rem", lg: "1rem", xl: "1.125rem" },
  menu: { sm: "0.8125rem", md: "0.875rem", lg: "1rem", xl: "1.125rem" },
};

export function sizeFor(level: TypographyLevelId, step: SizeStepId): string {
  return SIZES[level][step];
}

// ── Colores ───────────────────────────────────────────────────────────────────────────────

/** Los colores del sitio que se pueden elegir por nombre: si cambia la paleta, cambia el texto. */
export const PALETTE_COLORS = [
  { id: "text", label: "Texto", cssVar: "--wsite-text" },
  { id: "primary", label: "Principal", cssVar: "--wsite-primary" },
  { id: "secondary", label: "Secundario", cssVar: "--wsite-secondary" },
  { id: "accent", label: "Acento", cssVar: "--wsite-accent" },
] as const;
type PaletteColorId = (typeof PALETTE_COLORS)[number]["id"];

const HEX = /^#[0-9a-fA-F]{6}$/;
const colorSchema = z.union([z.enum(PALETTE_COLORS.map((c) => c.id) as [PaletteColorId, ...PaletteColorId[]]), z.string().regex(HEX)]);
export type LevelColor = z.infer<typeof colorSchema>;

export function colorToCss(color: LevelColor): string {
  const paleta = PALETTE_COLORS.find((c) => c.id === color);
  return paleta ? `var(${paleta.cssVar})` : color;
}

// ── Valores por nivel ─────────────────────────────────────────────────────────────────────

export type TypographyLevel = {
  font: string;
  size: SizeStepId;
  weight: number;
  color: LevelColor;
  uppercase: boolean;
};

/** Lo que el dueño cambió de un nivel. Un campo inválido se descarta solo (no tumba el resto). */
const levelOverrideSchema = z.object({
  font: z.enum(FONT_IDS).optional().catch(undefined),
  size: z.enum(SIZE_IDS).optional().catch(undefined),
  weight: z.number().int().min(100).max(900).optional().catch(undefined),
  color: colorSchema.optional().catch(undefined),
  uppercase: z.boolean().optional().catch(undefined),
});
export type TypographyLevelOverride = z.infer<typeof levelOverrideSchema>;

const nivelOpcional = levelOverrideSchema.optional().catch(undefined);
export const typographyLevelsSchema = z
  .object({
    title: nivelOpcional,
    heading: nivelOpcional,
    subtitle: nivelOpcional,
    body: nivelOpcional,
    button: nivelOpcional,
    menu: nivelOpcional,
  } satisfies Record<TypographyLevelId, typeof nivelOpcional>)
  .catch({});
export type TypographyLevels = Partial<Record<TypographyLevelId, TypographyLevelOverride>>;

/** Sin claves vacías: `{ title: {} }` es lo mismo que no haber tocado nada. */
export function compactTypographyLevels(levels: TypographyLevels): TypographyLevels {
  const out: TypographyLevels = {};
  for (const id of LEVEL_IDS) {
    const nivel = levels[id];
    if (!nivel) continue;
    const limpio = Object.fromEntries(Object.entries(nivel).filter(([, v]) => v !== undefined)) as TypographyLevelOverride;
    if (Object.keys(limpio).length > 0) out[id] = limpio;
  }
  return out;
}

/** La letra de títulos y la de texto de cada estilo de partida (lo que había antes). */
const PRESET_FONTS: Record<string, { heading: string; body: string }> = {
  institutional: { heading: "system-serif", body: "system-sans" },
  modern: { heading: "system-sans", body: "system-sans" },
  editorial: { heading: "system-serif", body: "system-serif" },
  contemporary: { heading: "helvetica", body: "system-sans" },
  photographic: { heading: "system-sans", body: "system-sans" },
};

/**
 * La base de cada nivel según el estilo de partida: reproduce exactamente lo que el sitio
 * mostraba antes de poder elegir por nivel.
 */
export function baseTypographyLevels(args: {
  typographyPreset: string;
  headingWeight: number;
  buttonWeight: number;
}): Record<TypographyLevelId, TypographyLevel> {
  const fuentes = PRESET_FONTS[args.typographyPreset] ?? PRESET_FONTS.modern;
  const titulo = { font: fuentes.heading, size: "md" as const, weight: args.headingWeight, color: "text" as const, uppercase: false };
  const texto = { font: fuentes.body, size: "md" as const, weight: 400, color: "text" as const, uppercase: false };
  return {
    title: titulo,
    heading: titulo,
    subtitle: texto,
    body: texto,
    button: { ...texto, weight: args.buttonWeight },
    menu: texto,
  };
}

/** Base + cambios del dueño, con el grosor ajustado a lo que trae cada letra. */
export function resolveTypographyLevels(
  base: Record<TypographyLevelId, TypographyLevel>,
  levels: TypographyLevels,
): Record<TypographyLevelId, TypographyLevel> {
  const out = {} as Record<TypographyLevelId, TypographyLevel>;
  for (const id of LEVEL_IDS) {
    const nivel = { ...base[id], ...compactTypographyLevels(levels)[id] };
    out[id] = { ...nivel, weight: nearestWeight(getFont(nivel.font), nivel.weight) };
  }
  return out;
}

/** Variables CSS `--wsite-<nivel>-*`, las que leen los bloques, el encabezado y el pie. */
export function typographyCssVars(levels: Record<TypographyLevelId, TypographyLevel>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const id of LEVEL_IDS) {
    const nivel = levels[id];
    vars[`--wsite-${id}-font`] = getFont(nivel.font).stack;
    vars[`--wsite-${id}-size`] = sizeFor(id, nivel.size);
    vars[`--wsite-${id}-weight`] = String(nivel.weight);
    vars[`--wsite-${id}-color`] = colorToCss(nivel.color);
    vars[`--wsite-${id}-transform`] = nivel.uppercase ? "uppercase" : "none";
  }
  return vars;
}

/**
 * El estilo que aplica un nivel, leyendo sus variables CSS. `color: false` donde el texto va
 * sobre una foto o una franja de color: ahí manda el blanco, por legibilidad.
 */
export function levelStyle(level: TypographyLevelId, options: { color: boolean }): CSSProperties {
  // `textTransform` y `fontWeight` aceptan `var(...)` en CSS, pero los tipos de React no lo saben.
  const estilo: Record<string, string> = {
    fontFamily: `var(--wsite-${level}-font)`,
    fontSize: `var(--wsite-${level}-size)`,
    fontWeight: `var(--wsite-${level}-weight)`,
    textTransform: `var(--wsite-${level}-transform)`,
    ...(options.color ? { color: `var(--wsite-${level}-color)` } : {}),
  };
  return estilo as CSSProperties;
}

/**
 * La hoja de Google Fonts con sólo las letras y grosores que el sitio usa de verdad; `null` si
 * todas son del sistema (no se descarga nada).
 */
export function googleFontsHref(levels: Record<TypographyLevelId, TypographyLevel>): string | null {
  const porLetra = new Map<string, Set<number>>();
  for (const id of LEVEL_IDS) {
    const font = getFont(levels[id].font);
    if (!font.google) continue;
    const pesos = porLetra.get(font.google) ?? new Set<number>();
    pesos.add(levels[id].weight);
    porLetra.set(font.google, pesos);
  }
  if (porLetra.size === 0) return null;
  const familias = [...porLetra.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nombre, pesos]) => `family=${nombre.replace(/ /g, "+")}:wght@${[...pesos].sort((a, b) => a - b).join(";")}`);
  return `https://fonts.googleapis.com/css2?${familias.join("&")}&display=swap`;
}
