import type { TemplateEditorTheme } from "@repo/template-editor-ui";

/**
 * La paleta de FotoOffice, traducida a los tokens del editor.
 *
 * Los valores son referencias a las variables de la aplicación, no colores copiados: si mañana
 * la institución cambia su acento, el editor cambia con ella y nadie tiene que acordarse de
 * tocar este archivo.
 *
 * Dos tokens no salen de la aplicación y son decisiones propias del editor:
 *
 * - `void`, el fondo detrás del pliego, es un gris frío oscuro y no el fondo del panel. El
 *   papel tiene que leerse como papel, y contra un fondo claro un pliego blanco desaparece.
 * - `accentInk` es blanco fijo: el acento de FotoOffice es un celeste saturado y el texto
 *   encima tiene que contrastar sí o sí, sin depender de lo que la aplicación defina para otra
 *   cosa.
 */
export const FOTOFFICE_EDITOR_THEME: TemplateEditorTheme = {
  void: "#4c535d",
  chrome: "var(--fo-bg)",
  chromeSunken: "var(--fo-surface-hover)",
  surface: "var(--fo-surface)",
  line: "var(--fo-border)",
  lineStrong: "var(--fo-border-strong)",
  ink: "var(--fo-text)",
  inkMuted: "var(--fo-muted)",
  inkFaint: "var(--fo-muted-soft)",
  accent: "var(--fo-accent)",
  accentInk: "#ffffff",
  accentWash: "var(--fo-accent-muted)",
  danger: "var(--fo-danger)",
  dangerWash: "var(--fo-danger-soft)",
  success: "var(--fo-success)",
  radius: "var(--fo-radius-sm)",
  control: "30px",
};
