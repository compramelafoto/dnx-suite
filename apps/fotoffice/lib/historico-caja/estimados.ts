/**
 * Gastos fijos estimados de un mes (los que se pagan fuera de la caja y el libro no muestra). Módulo PURO.
 *
 * Van marcados como `estimado` y con origen ESTIMADO: el resumen y el tablero los muestran aparte
 * para que nadie los confunda con lo anotado.
 */
import { claseEsperadaDeCodigo, normalizarConcepto, type MapeoHistorico, type MapeoValidado } from "./mapeo";
import type { FilaCsv, MovimientoHistorico } from "./tipos";

function ultimoDia(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function estimadosDelMes(
  mes: string,
  mapeo: MapeoHistorico | MapeoValidado,
  filasDelMes: readonly Pick<FilaCsv, "conceptoNormalizado" | "centavos">[],
): MovimientoHistorico[] {
  const pagados = new Set(filasDelMes.filter((f) => f.centavos < 0).map((f) => normalizarConcepto(f.conceptoNormalizado)));
  const out: MovimientoHistorico[] = [];
  for (const e of mapeo.estimados ?? []) {
    if (mes < e.desde || mes > e.hasta) continue;
    if ((e.soloSiNoHay ?? []).some((c) => pagados.has(normalizarConcepto(c)))) continue;
    const rubro = mapeo.rubros.find((r) => r.codigo === e.rubro);
    const dia = Math.min(e.dia ?? 1, ultimoDia(mes));
    out.push({
      fila: null,
      orden: 0,
      fecha: `${mes}-${String(dia).padStart(2, "0")}`,
      turno: null,
      medio: null,
      conceptoOriginal: e.concepto,
      conceptoNormalizado: normalizarConcepto(e.concepto),
      centavos: -Math.round(e.montoMensual * 100),
      referencia: e.nota ? `estimado: ${e.nota}` : "estimado",
      observacion: null,
      clase: rubro?.clase ?? claseEsperadaDeCodigo(e.rubro) ?? "SIN_CLASIFICAR",
      rubroCodigo: e.rubro,
      rubroNombre: rubro?.nombre ?? null,
      regla: null,
      origen: "ESTIMADO",
      estimado: true,
      motivos: [],
    });
  }
  return out;
}
