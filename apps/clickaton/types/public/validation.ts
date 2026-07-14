/**
 * Reglas públicas de validación (GPS, EXIF, horario, etc.).
 * Complementa `PublicValidationPolicy` resumida en la ficha.
 */

export type PublicValidationRuleType =
  | "gps"
  | "exif"
  | "time_window"
  | "integrity"
  | "quantity"
  | "device"
  | "editing"
  | "other";

export type PublicValidationRule = {
  id: string;
  type: PublicValidationRuleType;
  required: boolean;
  description: string;
  /** Texto orientado a participantes (no técnico interno). */
  publicExplanation: string;
};
