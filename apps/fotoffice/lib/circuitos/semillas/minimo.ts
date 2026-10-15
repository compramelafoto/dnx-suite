import type { SemillaCircuito } from "./dnx";

/** Circuito de ventas mínimo para organizaciones que no son DNX Estudio. */
export const CIRCUITO_MINIMO: SemillaCircuito = {
  name: "Circuito de ventas",
  kind: "VENTA",
  isDefault: true,
  stages: [
    { name: "Nueva", days: 2, color: "azul", leadStatus: "NEW" },
    { name: "Contactada", days: 2, color: "violeta", leadStatus: "CONTACTED" },
    { name: "Presupuesto enviado", days: 3, color: "azul", leadStatus: "QUOTED" },
    { name: "Interesada", days: 5, color: "violeta", leadStatus: "INTERESTED" },
  ],
};
