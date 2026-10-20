/**
 * Flujo de caja proyectado (etapa 6). Módulo PURO, en centavos enteros.
 *
 * Fila "Hoy": saldo de Caja + por cobrar vencido − por pagar vencido. Después, una fila por día,
 * semana (lunes a domingo) o mes, desde hoy hasta `hasta`. Las cuentas a pagar sin vencimiento van
 * aparte ("Sin fecha") y no suman al acumulado.
 */
import { diaDeSemana, etiquetaDia, sumarDias } from "./fechas";
import { etiquetaMes, mesDeDia, sumarMeses } from "./periodos";

export type AgrupacionFlujo = "dia" | "semana" | "mes";

export type CuotaFlujo = { dueDate: string; saldoCentavos: number };
export type CuentaFlujo = { dueDate: string | null; centavos: number };

export type FilaFlujo = {
  etiqueta: string;
  desde: string;
  hasta: string;
  porCobrar: number;
  porPagar: number;
  neto: number;
  acumulado: number;
  bajoMinimo: boolean;
};

export type FlujoProyectado = {
  hoy: {
    etiqueta: "Hoy";
    saldoCaja: number;
    vencidoCobrar: number;
    vencidoPagar: number;
    acumulado: number;
    bajoMinimo: boolean;
  };
  filas: FilaFlujo[];
  sinFecha: { etiqueta: "Sin fecha"; porPagar: number; cantidad: number };
  /** Primer día (inicio de la primera fila bajo el mínimo, "Hoy" incluido); `null` si nunca baja. */
  primeraFechaBajoMinimo: string | null;
};

export const MAX_FILAS_FLUJO = 400;

type Tramo = { etiqueta: string; desde: string; hasta: string };

function tramos(hoy: string, hasta: string, agrupar: AgrupacionFlujo): Tramo[] {
  const r: Tramo[] = [];
  let cursor = hoy;
  while (cursor <= hasta && r.length < MAX_FILAS_FLUJO) {
    let fin: string;
    let etiqueta: string;
    if (agrupar === "dia") {
      fin = cursor;
      etiqueta = etiquetaDia(cursor);
    } else if (agrupar === "semana") {
      fin = sumarDias(cursor, 6 - diaDeSemana(cursor));
      etiqueta = `Semana del ${etiquetaDia(cursor)}`;
    } else {
      const mes = mesDeDia(cursor);
      fin = sumarDias(`${sumarMeses(mes, 1)}-01`, -1);
      etiqueta = etiquetaMes(mes);
    }
    if (fin > hasta) fin = hasta;
    r.push({ etiqueta, desde: cursor, hasta: fin });
    cursor = sumarDias(fin, 1);
  }
  return r;
}

export function armarFlujo(entrada: {
  hoy: string;
  agrupar: AgrupacionFlujo;
  hasta: string;
  saldoCaja: number;
  cuotas: readonly CuotaFlujo[];
  cuentas: readonly CuentaFlujo[];
  saldoMinimo: number | null;
}): FlujoProyectado {
  const { hoy, hasta, saldoCaja, saldoMinimo } = entrada;
  const bajo = (v: number) => saldoMinimo !== null && v < saldoMinimo;

  let vencidoCobrar = 0;
  let vencidoPagar = 0;
  let sinFecha = 0;
  let cantidadSinFecha = 0;
  for (const c of entrada.cuotas) if (c.dueDate < hoy) vencidoCobrar += c.saldoCentavos;
  for (const c of entrada.cuentas) {
    if (c.dueDate === null) {
      sinFecha += c.centavos;
      cantidadSinFecha++;
    } else if (c.dueDate < hoy) vencidoPagar += c.centavos;
  }

  const acumuladoHoy = saldoCaja + vencidoCobrar - vencidoPagar;
  let acumulado = acumuladoHoy;
  let primera: string | null = bajo(acumuladoHoy) ? hoy : null;

  const filas: FilaFlujo[] = tramos(hoy, hasta, entrada.agrupar).map((t) => {
    let porCobrar = 0;
    let porPagar = 0;
    for (const c of entrada.cuotas) if (c.dueDate >= t.desde && c.dueDate <= t.hasta) porCobrar += c.saldoCentavos;
    for (const c of entrada.cuentas) if (c.dueDate !== null && c.dueDate >= t.desde && c.dueDate <= t.hasta) porPagar += c.centavos;
    const neto = porCobrar - porPagar;
    acumulado += neto;
    const bajoMinimo = bajo(acumulado);
    if (bajoMinimo && primera === null) primera = t.desde;
    return { ...t, porCobrar, porPagar, neto, acumulado, bajoMinimo };
  });

  return {
    hoy: { etiqueta: "Hoy", saldoCaja, vencidoCobrar, vencidoPagar, acumulado: acumuladoHoy, bajoMinimo: bajo(acumuladoHoy) },
    filas,
    sinFecha: { etiqueta: "Sin fecha", porPagar: sinFecha, cantidad: cantidadSinFecha },
    primeraFechaBajoMinimo: primera,
  };
}
