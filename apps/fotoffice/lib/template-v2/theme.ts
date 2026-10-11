import { DEFAULT_EDITOR_THEME, type TemplateEditorTheme } from "@repo/template-editor-ui";

/**
 * El diseñador en FotoOffice: el marco oscuro del editor (estilo Photoshop) con el acento de la
 * institución.
 *
 * Antes el marco copiaba los colores claros de la aplicación. Se pasó al tema oscuro común a
 * todas las plataformas para que la pieza sea lo único claro de la pantalla; el pliego sigue
 * blanco porque es papel. El acento sigue saliendo de la aplicación: si la institución lo
 * cambia, el editor cambia con ella.
 */
export const FOTOFFICE_EDITOR_THEME: TemplateEditorTheme = {
  ...DEFAULT_EDITOR_THEME,
  accent: "var(--fo-accent)",
  accentInk: "#ffffff",
  accentWash: "color-mix(in srgb, var(--fo-accent) 24%, transparent)",
};
