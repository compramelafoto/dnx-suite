/** Datos de prueba compartidos por las pruebas del histórico (no son datos reales). */
import type { FilaCsv } from "./tipos";
import type { MapeoHistorico } from "./mapeo";

export const MAPEO_PRUEBA: MapeoHistorico = {
  version: 1,
  rubros: [
    { codigo: "3.1", nombre: "Fotos carnet", clase: "INGRESO" },
    { codigo: "3.2", nombre: "Impresiones", clase: "INGRESO" },
    { codigo: "3.90", nombre: "Otros ingresos", clase: "INGRESO" },
    { codigo: "3.99", nombre: "Otros ingresos sin identificar", clase: "INGRESO" },
    { codigo: "4.1", nombre: "Logística (cadete)", clase: "COSTO_VARIABLE" },
    { codigo: "5.1", nombre: "Alquiler", clase: "GASTO_FIJO" },
    { codigo: "5.11", nombre: "Expensas", clase: "GASTO_FIJO" },
    { codigo: "5.99", nombre: "Otros gastos", clase: "GASTO_FIJO" },
    { codigo: "6.1", nombre: "Gastos personales del dueño", clase: "RETIRO_DUENO" },
    { codigo: "0.1", nombre: "Fondos para pagar gastos fuera de caja", clase: "MOVIMIENTO_INTERNO" },
  ],
  reglas: [
    { concepto: "CARNET", rubro: "3.1", confianza: "alta" },
    { concepto: "IMPRESIONES", rubro: "3.2", confianza: "alta" },
    { concepto: "CADETE", rubro: "4.1", confianza: "alta" },
    { concepto: "EXPENSAS", rubro: "5.11", confianza: "alta" },
    { concepto: "OTROS", signo: "+", rubro: "3.90", confianza: "baja" },
    { concepto: "OTROS", signo: "+", montoMinimo: 100_000, rubro: "3.99", confianza: "baja" },
    { concepto: "OTROS", signo: "-", rubro: "5.99", confianza: "baja" },
    { concepto: "KINESIO", rubro: "6.1", confianza: "baja" },
    { concepto: "RETIROS", rubro: "0.1", confianza: "alta" },
  ],
  estimados: [
    { concepto: "ALQUILER (estimado)", rubro: "5.1", montoMensual: 380_000, desde: "2026-01", hasta: "2026-09", dia: 10 },
    {
      concepto: "EXPENSAS (estimado)",
      rubro: "5.11",
      montoMensual: 75_000,
      desde: "2026-01",
      hasta: "2026-09",
      dia: 10,
      soloSiNoHay: ["EXPENSAS"],
    },
  ],
  avisos: [{ desde: "2024-01", hasta: "2025-12", texto: "Gastos fijos incompletos" }],
};

let n = 1;
export function fila(fecha: string, concepto: string, pesos: number, extra: Partial<FilaCsv> = {}): FilaCsv {
  n += 1;
  return {
    fila: n,
    fecha,
    turno: null,
    medio: "EFECTIVO",
    conceptoOriginal: concepto,
    conceptoNormalizado: concepto,
    centavos: Math.round(pesos * 100),
    referencia: `prueba | ${n}`,
    observacion: null,
    ...extra,
  };
}
