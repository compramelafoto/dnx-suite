import type { StudioLocalSales } from "@repo/cuanto-cobro-core";
import { mesSiguiente } from "@/lib/dnx-bot/dia-argentino";
import { mesDeInstante } from "@/lib/informes/periodos";

export type MesCompleto = { month: string; desde: string; hasta: string };

function mesAnterior(mes: string): string {
  const anio = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7));
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, "0")}`;
}

/** Meses calendario completos anteriores al de `hoyAR` (AAAA-MM-DD), el más reciente primero. `hasta` es exclusivo. */
export function mesesCompletos(hoyAR: string, cantidad = 3): MesCompleto[] {
  const salida: MesCompleto[] = [];
  let mes = hoyAR.slice(0, 7);
  for (let i = 0; i < cantidad; i++) {
    mes = mesAnterior(mes);
    salida.push({ month: mes, desde: `${mes}-01`, hasta: `${mesSiguiente(mes)}-01` });
  }
  return salida;
}

/**
 * Suma por mes. `occurredAt` guarda instantes UTC (Informes lee con límites -03:00): cada movimiento va al
 * mes argentino que le toca, con `mesDeInstante`.
 */
export function sumarVentasPorMes(filas: { occurredAt: Date; amountArs: number }[], meses: MesCompleto[]): StudioLocalSales {
  const totales = new Map<string, number>();
  for (const f of filas) {
    const mes = mesDeInstante(f.occurredAt);
    if (!meses.some((m) => m.month === mes)) continue;
    totales.set(mes, (totales.get(mes) ?? 0) + f.amountArs);
  }
  return { months: meses.filter((m) => totales.has(m.month)).map((m) => ({ month: m.month, sales: totales.get(m.month) as number })) };
}
