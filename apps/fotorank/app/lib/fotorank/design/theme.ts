import { DEFAULT_EDITOR_THEME, type TemplateEditorTheme } from "@repo/template-editor-ui";

/**
 * El diseñador en FotoRank: el marco claro de siempre y el dorado de la marca como acento.
 *
 * El marco no se oscurece aunque el panel de FotoRank sea negro: el diploma es papel y se tiene
 * que leer como papel, y los paneles del editor están pensados sobre fondo claro.
 */
export const FOTORANK_EDITOR_THEME: TemplateEditorTheme = {
  ...DEFAULT_EDITOR_THEME,
  void: "#3a3833",
  accent: "#b8892d",
  accentInk: "#ffffff",
  accentWash: "#f5ecd6",
};
