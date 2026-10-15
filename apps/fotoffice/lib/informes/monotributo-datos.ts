import "server-only";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { puedeVerInformes, type CtxInformes } from "./acceso";
import { leerAjustesInformes } from "./ajustes";
import { AVISO_DEMASIADOS_DATOS, LEYENDA_MONOTRIBUTO } from "./constantes";
import { armarMonotributo, mesesMonotributo, type ResultadoMonotributo } from "./monotributo";
import { leerMovimientosConOriginales } from "./resultados-datos";
import { asientosDeCaja } from "./resultados";

/**
 * Lectura del control de monotributo (etapa 6): ingresos de Caja de los últimos 12 meses móviles,
 * sin transferencias y netos de anulaciones, contra el tope de Ajustes.
 */

/** Ingresos netos de Caja por mes "AAAA-MM" (centavos), o `null` si se pasa el tope de movimientos. */
export async function leerIngresosMonotributo(workspaceId: string, hoy: string): Promise<Record<string, number> | null> {
  const meses = mesesMonotributo(hoy);
  const l = await leerMovimientosConOriginales(workspaceId, meses[0], meses[meses.length - 1], { soloIngresos: true });
  if (!l) return null;
  const porMes: Record<string, number> = {};
  for (const a of asientosDeCaja(l.movs, l.originales)) {
    if (a.kind !== "INGRESO") continue;
    porMes[a.mes] = (porMes[a.mes] ?? 0) + a.centavos * a.signo;
  }
  return porMes;
}

export type MonotributoCargado = {
  hoy: string;
  /** `null` si se pasó el tope de datos. */
  resultado: ResultadoMonotributo | null;
  categoria: string | null;
  tope: number | null;
  avisoPct: number;
  leyenda: string;
  avisos: string[];
};

/** Control de monotributo. `null` si la persona no tiene permiso (no se lee nada). */
export async function cargarMonotributo(ctx: CtxInformes, ahora: Date = new Date()): Promise<MonotributoCargado | null> {
  if (!puedeVerInformes(ctx)) return null;
  const hoy = hoyEnBuenosAires(ahora);
  const [ajustes, ingresos] = await Promise.all([leerAjustesInformes(ctx.workspaceId), leerIngresosMonotributo(ctx.workspaceId, hoy)]);
  const base = {
    hoy,
    categoria: ajustes.monotributoCategory,
    tope: ajustes.monotributoCapCentavos,
    avisoPct: ajustes.monotributoWarnPct,
    leyenda: LEYENDA_MONOTRIBUTO,
  };
  if (!ingresos) return { ...base, resultado: null, avisos: [AVISO_DEMASIADOS_DATOS] };
  return {
    ...base,
    resultado: armarMonotributo({ hoy, ingresosPorMes: ingresos, tope: ajustes.monotributoCapCentavos, avisoPct: ajustes.monotributoWarnPct }),
    avisos: [],
  };
}
