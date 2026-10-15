import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { aplicarParche, perfilBase, type ParchePerfil } from "../motor";

/**
 * Perfil de precios con el que corre `bot:eval`: un fotógrafo de Rosario que vive de la fotografía,
 * con montos de 2026 (valor hora ≈ $26.000, un casamiento ≈ $1.000.000). Antes se usaba el
 * perfil de las pruebas del motor, con un valor hora de $1.848: los resultados no se parecían a
 * lo que ve Daniel y daban porcentajes absurdos (2026 % de ganancia).
 * Se arma con `aplicarParche`, el mismo camino que usa el bot: ninguna cuenta propia.
 */
export const PARCHE_DE_PRUEBA: ParchePerfil = {
  moneda: "ARS",
  viveSoloDeFotografia: "si",
  gastosPersonales: [
    { grupoId: "housing", itemId: "rent-mortgage", monto: "650000" },
    { grupoId: "housing", itemId: "expenses-fees", monto: "120000" },
    { grupoId: "housing", itemId: "home-utilities", monto: "150000" },
    { grupoId: "food", itemId: "supermarket", monto: "700000" },
    { grupoId: "health", itemId: "health-insurance", monto: "250000" },
    { grupoId: "transport", itemId: "fuel", monto: "200000" },
    { grupoId: "communication", itemId: "mobile", monto: "30000" },
    { grupoId: "communication", itemId: "home-internet", monto: "35000" },
  ],
  negocio: { alquiler: "0", software: "90000", publicidad: "150000", colaboradores: "0" },
  equipo: { renovacionMensual: "350000" },
  horasSemana: "28",
  distribucion: { unidad: "horas", coberturas: "9", edicion: "10", administracion: "4", ventas: "3", publicidad: "1", capacitacion: "1" },
  fondoEmergencia: "150000",
  ahorro: "300000",
  posicionamiento: "stable",
};

export function perfilDePrueba(): CuantoCobroProfileInput {
  const r = aplicarParche(perfilBase(null), PARCHE_DE_PRUEBA);
  if (r.errores.length) throw new Error(`Perfil de prueba inválido: ${r.errores.join(" ")}`);
  return r.perfil;
}
