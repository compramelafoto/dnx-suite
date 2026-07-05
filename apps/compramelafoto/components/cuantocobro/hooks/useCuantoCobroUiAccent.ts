"use client";

import { CC_GREEN_PRIMARY } from "@/lib/cuantocobro/theme";

/**
 * Color de acento de la UI de ¿Cuánto Cobro? (verde institucional).
 * El color de marca del fotógrafo se usa solo en el PDF, no en el entorno de la app.
 */
export function useCuantoCobroUiAccent(_brandingSnapshot?: unknown): string {
  return CC_GREEN_PRIMARY;
}
