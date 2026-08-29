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
 * Valores por omisión: grises neutros y un acento sobrio.
 *
 * No son los de ninguna aplicación a propósito. Un host que no mapee nada tiene que verse
 * intencional, no como si le faltara algo.
 */
export const DEFAULT_EDITOR_THEME: Record<TemplateEditorTokenName, string> = {
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
  radius: "6px",
  control: "30px",
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
export function editorThemeStyle(theme?: TemplateEditorTheme): CSSProperties {
  const style: Record<string, string> = {};
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
