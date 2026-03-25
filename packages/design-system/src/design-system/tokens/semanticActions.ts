/**
 * Colores semánticos para acciones.
 * delete/cancel -> rojo, save/confirm -> verde, copy/info -> azul, warning -> amarillo, disable -> gris
 */

export const semanticColors = {
  danger: "#ef4444",
  success: "#22c55e",
  info: "#3b82f6",
  warning: "#eab308",
  muted: "#737373",
} as const;

export type SemanticActionKey = keyof typeof semanticColors;
