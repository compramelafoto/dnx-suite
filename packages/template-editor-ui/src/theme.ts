import type { CSSProperties } from "react";

/**
 * Tokens visuales del editor.
 *
 * Existen porque el editor se incrusta en aplicaciones distintas y hasta ahora tenía los
 * colores de una sola escritos a mano: 52 apariciones del naranja de Clickatón repartidas por
 * el paquete. Abierto desde FotoOffice, el editor se veía como otro producto.
 *
 * El host pasa su mapeo y los valores viajan como propiedades CSS en el elemento raíz del
 * editor. Un valor puede ser un color literal o una referencia a un token del host
 * (`var(--fo-accent)`), que es lo que permite que el editor siga al tema de la aplicación sin
 * que el paquete sepa nada de ella.
 *
 * Regla de la que sale la paleta: **el marco no lleva color.** Cualquier cromatismo en la
 * interfaz compite con el que la persona está eligiendo para su pieza. El acento aparece solo
 * donde significa "esto es lo que estás tocando" — selección, foco y la acción principal.
 */
export type TemplateEditorTokenName =
  /** El fondo detrás del pliego. Más oscuro que el papel para que el papel se lea como papel. */
  | "void"
  /** Paneles y barras. */
  | "chrome"
  /** Fondo hundido dentro de un panel: hover, pistas de control. */
  | "chromeSunken"
  /** Superficie elevada: campos, menús, el pliego. */
  | "surface"
  | "line"
  | "lineStrong"
  | "ink"
  | "inkMuted"
  | "inkFaint"
  /** Solo para selección, foco y acción principal. */
  | "accent"
  /** Texto sobre el acento. */
  | "accentInk"
  /** Fondo tenue del acento: fila seleccionada, anillo de foco. */
  | "accentWash"
  | "danger"
  | "dangerWash"
  | "success"
  /** Radio de esquina de los controles. */
  | "radius"
  /** Alto de un control de barra. Gobierna la densidad de toda la interfaz. */
  | "control";

export type TemplateEditorTheme = Partial<Record<TemplateEditorTokenName, string>>;

/**
 * Valores por omisión: tema oscuro al estilo de los programas de edición de imagen (Photoshop,
 * Lightroom). El gris carbón deja que la pieza sea lo único claro de la pantalla, y el ojo juzga
 * mejor los colores de la pieza contra un entorno neutro y oscuro.
 *
 * No son los de ninguna aplicación a propósito. Un host que no mapee nada tiene que verse
 * intencional, no como si le faltara algo. El pliego no usa estos colores: es papel.
 */
export const DEFAULT_EDITOR_THEME: Record<TemplateEditorTokenName, string> = {
  void: "#262626",
  chrome: "#323232",
  chromeSunken: "#2a2a2a",
  surface: "#3a3a3a",
  line: "#454545",
  lineStrong: "#5c5c5c",
  ink: "#e6e6e6",
  // Contraste mínimo 4,5:1 sobre los paneles (#323232) para el texto secundario.
  inkMuted: "#b4b4b4",
  inkFaint: "#a3a3a3",
  accent: "#3b8eea",
  accentInk: "#ffffff",
  accentWash: "rgba(59, 142, 234, 0.22)",
  danger: "#f2726c",
  dangerWash: "rgba(242, 114, 108, 0.14)",
  success: "#5cc07a",
  radius: "3px",
  control: "28px",
};

/**
 * El tema claro que el editor tenía antes del oscuro. Lo usan los componentes del paquete que
 * viven fuera del editor, en páginas claras de cada app (el botón "Crear plantilla" de la
 * lista): con el tema oscuro su menú quedaba como una mancha negra en una página blanca.
 */
export const LIGHT_EDITOR_THEME: Record<TemplateEditorTokenName, string> = {
  void: "#5b6068",
  chrome: "#f7f8f9",
  chromeSunken: "#eef0f2",
  surface: "#ffffff",
  line: "#dfe2e6",
  lineStrong: "#c7ccd3",
  ink: "#16181d",
  inkMuted: "#666d78",
  inkFaint: "#949aa4",
  accent: "#4a5568",
  accentInk: "#ffffff",
  accentWash: "#eceef1",
  danger: "#b4242a",
  dangerWash: "#fdf0f0",
  success: "#3f8f57",
  radius: "4px",
  control: "28px",
};

/**
 * Colores claros que rigen dentro del pliego. El pliego es papel: los recuadros de ejemplo, los
 * textos sin color propio y los tiradores de selección tienen que verse sobre blanco igual que
 * siempre, aunque el marco del editor sea oscuro. El acento no se toca: la selección sigue siendo
 * del color del editor.
 */
export const PAPER_TOKENS: Record<string, string> = {
  "--te-chrome": "#f7f8f9",
  "--te-chrome-sunken": "#eef0f2",
  "--te-surface": "#ffffff",
  "--te-line": "#dfe2e6",
  "--te-line-strong": "#c7ccd3",
  "--te-ink": "#16181d",
  "--te-ink-muted": "#666d78",
  "--te-ink-faint": "#949aa4",
  colorScheme: "light",
  color: "#111827",
};

const CSS_VAR: Record<TemplateEditorTokenName, string> = {
  void: "--te-void",
  chrome: "--te-chrome",
  chromeSunken: "--te-chrome-sunken",
  surface: "--te-surface",
  line: "--te-line",
  lineStrong: "--te-line-strong",
  ink: "--te-ink",
  inkMuted: "--te-ink-muted",
  inkFaint: "--te-ink-faint",
  accent: "--te-accent",
  accentInk: "--te-accent-ink",
  accentWash: "--te-accent-wash",
  danger: "--te-danger",
  dangerWash: "--te-danger-wash",
  success: "--te-success",
  radius: "--te-radius",
  control: "--te-control",
};

/**
 * Las propiedades CSS a poner en el elemento raíz del editor.
 *
 * Se aplican inline y no por hoja de estilos para no depender del orden de la cascada: el
 * paquete no controla en qué momento carga el CSS de cada aplicación.
 */
/**
 * Escala de redondeo propia del editor. Tailwind resuelve `rounded-md`, `rounded-xl`, etc. con
 * variables `--radius-*` que cada app redefine: en CompraMeLaFoto `rounded-md` valía 16 px y el
 * editor entero se veía hecho de píldoras, el pliego incluido. Redefinirlas en la raíz del
 * editor hace que se vea igual en todas las apps.
 */
const EDITOR_RADIUS_SCALE: Record<string, string> = {
  "--radius-xs": "2px",
  "--radius-sm": "3px",
  "--radius-md": "4px",
  "--radius-lg": "5px",
  "--radius-xl": "6px",
  "--radius-2xl": "8px",
  "--radius-3xl": "10px",
};

export function editorThemeStyle(
  theme?: TemplateEditorTheme,
  scheme: "dark" | "light" = "dark"
): CSSProperties {
  // Los controles nativos (desplegables, selector de color, barras de scroll) siguen al tema.
  const style: Record<string, string> = { ...EDITOR_RADIUS_SCALE, colorScheme: scheme };
  for (const [name, cssVar] of Object.entries(CSS_VAR) as [
    TemplateEditorTokenName,
    string,
  ][]) {
    style[cssVar] = theme?.[name] ?? DEFAULT_EDITOR_THEME[name];
  }
  return style as CSSProperties;
}

/** Atajos para escribir `var(--te-…)` sin equivocarse en el nombre. */
export const te = {
  void: "var(--te-void)",
  chrome: "var(--te-chrome)",
  chromeSunken: "var(--te-chrome-sunken)",
  surface: "var(--te-surface)",
  line: "var(--te-line)",
  lineStrong: "var(--te-line-strong)",
  ink: "var(--te-ink)",
  inkMuted: "var(--te-ink-muted)",
  inkFaint: "var(--te-ink-faint)",
  accent: "var(--te-accent)",
  accentInk: "var(--te-accent-ink)",
  accentWash: "var(--te-accent-wash)",
  danger: "var(--te-danger)",
  dangerWash: "var(--te-danger-wash)",
  success: "var(--te-success)",
} as const;
