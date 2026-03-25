/**
 * Escala de espaciado base (design tokens).
 *
 * Uso recomendado:
 * - Importar `spacing` desde `@repo/design-system` o `@repo/design-system/tokens`.
 * - Usar solo claves de esta escala (1, 2, 3, 4, 5, 6, 8, …) en margin, padding y gap.
 * - No mezclar con valores mágicos (`12px`, `1.25rem`) salvo casos excepcionales documentados.
 *
 * Mapeo orientativo:
 * - 1–2: micro (entre icono y texto, tight)
 * - 3–4: campos, grupos internos
 * - 6–8: secciones, bloques de formulario
 * - 10+: pantalla / hero / separación grande
 */

export const spacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  /** Cabeceras modales (py-5), ritmo 8px × 2.5 */
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
} as const;

export type Spacing = typeof spacing;
