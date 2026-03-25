/**
 * Radios de borde reutilizables.
 * Consistencia visual para input, button, card, modal, pill.
 */

export const radius = {
  input: "0.375rem",   // 6px
  button: "0.5rem",   // 8px
  card: "1rem",       // 16px
  modal: "1.25rem",   // 20px
  pill: "9999px",
  none: "0",
} as const;

export type Radius = typeof radius;
