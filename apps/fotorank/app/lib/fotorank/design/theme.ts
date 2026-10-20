import { DEFAULT_EDITOR_THEME, type TemplateEditorTheme } from "@repo/template-editor-ui";

/**
 * El diseñador en FotoRank: el marco oscuro del editor (estilo Photoshop) y el dorado de la
 * marca como acento. El diploma sigue sobre pliego blanco: es papel y se tiene que leer como
 * papel.
 */
export const FOTORANK_EDITOR_THEME: TemplateEditorTheme = {
  ...DEFAULT_EDITOR_THEME,
  accent: "#b8892d",
  accentInk: "#ffffff",
  accentWash: "rgba(184, 137, 45, 0.24)",
};
