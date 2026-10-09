/**
 * Control de monotributo (etapa 6). Módulo PURO.
 *
 * Ingresos de Caja de los últimos 12 meses móviles (el mes en curso y los 11 anteriores) contra el
 * tope cargado a mano. Todo en centavos enteros; los bordes del semáforo se comparan con enteros
 * (nunca con el porcentaje en coma flotante).
 */
import { mesDeDia, mesesEntre, sumarMeses } from "./periodos";

export type EstadoMonotributo = "SIN_CONFIGURAR" | "VERDE" | "AMARILLO" | "ROJO";

export type EntradaMonotributo = {
  hoy: string;
  /** Ingresos netos de Caja por mes "AAAA-MM", en centavos. Los meses sin dato valen 0. */
  ingresosPorMes: Readonly<Record<string, number>>;
  /** Tope anual en centavos; `null` si no está configurado. */
  tope: number | null;
  /** Porcentaje de aviso (50 a 99). */
  avisoPct: number;
};

export type ResultadoMonotributo = {
  meses: { mes: string; centavos: number }[];
  total: number;
  /** Porcentaje usado, con dos decimales, sin redondear hacia arriba; `null` si no hay tope. */
  porcentaje: number | null;
  estado: EstadoMonotributo;
  /** Lo que falta para llegar al tope (0 si ya lo alcanzó); `null` si no hay tope. */
  falta: number | null;
};

export function mesesMonotributo(hoy: string): string[] {
  const actual = mesDeDia(hoy);
  return mesesEntre(sumarMeses(actual, -11), actual);
}

export function armarMonotributo(entrada: EntradaMonotributo): ResultadoMonotributo {
  const meses = mesesMonotributo(entrada.hoy).map((mes) => ({ mes, centavos: entrada.ingresosPorMes[mes] ?? 0 }));
  const total = meses.reduce((s, m) => s + m.centavos, 0);
  const { tope, avisoPct } = entrada;
  if (tope === null || tope <= 0) return { meses, total, porcentaje: null, estado: "SIN_CONFIGURAR", falta: null };

  const porcentaje = Math.floor((total * 10000) / tope) / 100;
  let estado: EstadoMonotributo = "VERDE";
  if (total >= tope) estado = "ROJO";
  else if (total * 100 >= tope * avisoPct) estado = "AMARILLO";
  return { meses, total, porcentaje, estado, falta: Math.max(0, tope - total) };
}
