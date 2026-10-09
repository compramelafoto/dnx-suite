import "server-only";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { puedeVerInformes, type CtxInformes } from "./acceso";
import { leerAjustesInformes } from "./ajustes";
import { AVISO_DEMASIADOS_DATOS, LEYENDA_MONOTRIBUTO } from "./constantes";
import { sumarDias } from "./fechas";
import { armarFlujo } from "./flujo";
import { hastaDeHorizonte, leerCuentasPorPagar, leerCuotasPorCobrar, leerSaldosDeCaja, type SaldosDeCaja } from "./flujo-datos";
import { armarMonotributo, type ResultadoMonotributo } from "./monotributo";
import { leerIngresosMonotributo } from "./monotributo-datos";
import { mesDeDia, sumarMeses } from "./periodos";
import { leerAsientosDeCaja, leerRubros } from "./resultados-datos";
import { armarResultados } from "./resultados";

/**
 * Tablero de Informes (etapa 6): lo que importa de un vistazo. Cada bloque falla por separado
 * (`null` + aviso) si se pasa un tope de datos. "En 7 / 30 días" son acumulados desde hoy: el de 30
 * incluye lo de 7. El horizonte para la primera fecha bajo el mínimo es de 3 meses.
 */

export type EnVencimientos = { vencido: number; en7: number; en30: number };
export type EnPagos = EnVencimientos & { sinFecha: number };

export type ResultadoMes = { mes: string; ingresos: number; egresos: number; resultado: number };

export type Tablero = {
  hoy: string;
  porCobrar: EnVencimientos | null;
  porPagar: EnPagos | null;
  saldos: SaldosDeCaja;
  saldoMinimo: number | null;
  /** Primer día en que el acumulado proyectado baja del mínimo (3 meses); `null` si no baja o no hay mínimo. */
  primeraFechaBajoMinimo: string | null;
  /** Base "cobrado y pagado": el mes en curso y el anterior. */
  resultadoMes: ResultadoMes | null;
  resultadoMesAnterior: ResultadoMes | null;
  monotributo: (ResultadoMonotributo & { categoria: string | null; tope: number | null; leyenda: string }) | null;
  avisos: string[];
};

function vencimientos(items: readonly { dueDate: string | null; centavos: number }[], hoy: string): EnPagos {
  const t7 = sumarDias(hoy, 7);
  const t30 = sumarDias(hoy, 30);
  const r: EnPagos = { vencido: 0, en7: 0, en30: 0, sinFecha: 0 };
  for (const i of items) {
    if (i.dueDate === null) r.sinFecha += i.centavos;
    else if (i.dueDate < hoy) r.vencido += i.centavos;
    else {
      if (i.dueDate <= t7) r.en7 += i.centavos;
      if (i.dueDate <= t30) r.en30 += i.centavos;
    }
  }
  return r;
}

/** El tablero. `null` si la persona no tiene permiso (no se lee nada). */
export async function cargarTablero(ctx: CtxInformes, ahora: Date = new Date()): Promise<Tablero | null> {
  if (!puedeVerInformes(ctx)) return null;
  const { workspaceId } = ctx;
  const hoy = hoyEnBuenosAires(ahora);
  const actual = mesDeDia(hoy);
  const anterior = sumarMeses(actual, -1);
  const hasta = hastaDeHorizonte(hoy, "3m");

  const [ajustes, cuotas, cuentas, saldos, asientos, ingresosMono] = await Promise.all([
    leerAjustesInformes(workspaceId),
    leerCuotasPorCobrar(workspaceId, hasta),
    leerCuentasPorPagar(workspaceId, hasta),
    leerSaldosDeCaja(workspaceId),
    leerAsientosDeCaja(workspaceId, anterior, actual),
    leerIngresosMonotributo(workspaceId, hoy),
  ]);
  const avisos: string[] = [];
  const aviso = (donde: string) => avisos.push(`${AVISO_DEMASIADOS_DATOS} (${donde})`);

  let porCobrar: EnVencimientos | null = null;
  if (cuotas) {
    const { sinFecha: _s, ...resto } = vencimientos(cuotas.map((c) => ({ dueDate: c.dueDate, centavos: c.saldoCentavos })), hoy);
    void _s;
    porCobrar = resto;
  } else aviso("Por cobrar");

  let porPagar: EnPagos | null = null;
  if (cuentas) porPagar = vencimientos(cuentas.map((c) => ({ dueDate: c.dueDate, centavos: c.centavos })), hoy);
  else aviso("Por pagar");

  let primeraFechaBajoMinimo: string | null = null;
  if (cuotas && cuentas && ajustes.minBalanceCentavos !== null) {
    const f = armarFlujo({
      hoy, agrupar: "dia", hasta, saldoCaja: saldos.total,
      cuotas, cuentas, saldoMinimo: ajustes.minBalanceCentavos,
    });
    primeraFechaBajoMinimo = f.primeraFechaBajoMinimo;
  }

  let resultadoMes: ResultadoMes | null = null;
  let resultadoMesAnterior: ResultadoMes | null = null;
  if (asientos) {
    const rubros = await leerRubros(workspaceId);
    const m = armarResultados({ meses: [anterior, actual], rubros, asientos });
    const bloque = (c: string) => m.bloques.find((b) => b.clave === c)!;
    const deMes = (i: number): ResultadoMes => ({
      mes: m.meses[i],
      ingresos: bloque("INGRESOS").porMes[i] + bloque("SIN_CLASIFICAR_INGRESO").porMes[i],
      egresos: bloque("COSTOS").porMes[i] + bloque("GASTOS").porMes[i] + bloque("SIN_CLASIFICAR_EGRESO").porMes[i],
      resultado: m.resultado.porMes[i],
    });
    resultadoMesAnterior = deMes(0);
    resultadoMes = deMes(1);
  } else aviso("Resultado");

  let monotributo: Tablero["monotributo"] = null;
  if (ingresosMono) {
    monotributo = {
      ...armarMonotributo({ hoy, ingresosPorMes: ingresosMono, tope: ajustes.monotributoCapCentavos, avisoPct: ajustes.monotributoWarnPct }),
      categoria: ajustes.monotributoCategory,
      tope: ajustes.monotributoCapCentavos,
      leyenda: LEYENDA_MONOTRIBUTO,
    };
  } else aviso("Monotributo");

  return { hoy, porCobrar, porPagar, saldos, saldoMinimo: ajustes.minBalanceCentavos, primeraFechaBajoMinimo, resultadoMes, resultadoMesAnterior, monotributo, avisos };
}
