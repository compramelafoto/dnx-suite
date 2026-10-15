/**
 * Arma los lotes del histórico, uno por mes: clasifica, marca lo que hay que revisar, agrega los
 * estimados, busca faltantes y resume. Módulo PURO.
 *
 * Idempotente: la misma entrada da los mismos movimientos y la misma huella. Re-importar un mes
 * reemplaza su lote (eso lo hace el repositorio); acá sólo se garantiza que el contenido sea estable.
 */
import { createHash } from "node:crypto";
import { estimadosDelMes } from "./estimados";
import { faltantesRecurrentes, type PresenciaGasto } from "./faltantes";
import { clasificarFila, type MapeoHistorico, type MapeoValidado } from "./mapeo";
import { motivosDeRevision, type OpcionesRevision } from "./revision";
import {
  CLASES_HISTORICO,
  mesDeFecha,
  type ClaseHistorico,
  type FilaCsv,
  type LoteArmado,
  type MovimientoHistorico,
  type ResumenLote,
  type TotalRubro,
} from "./tipos";

/** Todas las filas del CSV clasificadas y con sus motivos de revisión (mirando toda la importación). */
export function clasificarTodo(
  filas: readonly FilaCsv[],
  mapeo: MapeoHistorico | MapeoValidado,
  opciones: OpcionesRevision = {},
): MovimientoHistorico[] {
  const conClase = filas.map((f) => ({ ...f, clasificacion: clasificarFila(f, mapeo) }));
  const motivos = motivosDeRevision(conClase, opciones);
  return conClase.map(({ clasificacion: c, ...f }, i) => ({
    ...f,
    orden: 0,
    clase: c.clase,
    rubroCodigo: c.rubroCodigo,
    rubroNombre: c.rubroNombre,
    regla: c.regla,
    origen: "CSV" as const,
    estimado: false,
    motivos: [...new Set(motivos[i])],
  }));
}

export function mesesDe(filas: readonly Pick<FilaCsv, "fecha">[]): string[] {
  return [...new Set(filas.map((f) => mesDeFecha(f.fecha)))].sort();
}

function presencia(m: MovimientoHistorico): PresenciaGasto {
  return { mes: mesDeFecha(m.fecha), concepto: m.conceptoNormalizado, rubroCodigo: m.rubroCodigo, rubroNombre: m.rubroNombre, clase: m.clase };
}

function avisosDelMes(mes: string, mapeo: MapeoHistorico | MapeoValidado): string[] {
  return (mapeo.avisos ?? []).filter((a) => mes >= a.desde && mes <= a.hasta).map((a) => a.texto);
}

function ordenRubro(a: TotalRubro, b: TotalRubro): number {
  const ca = CLASES_HISTORICO.indexOf(a.clase);
  const cb = CLASES_HISTORICO.indexOf(b.clase);
  if (ca !== cb) return ca - cb;
  return (a.codigo ?? "~").localeCompare(b.codigo ?? "~", "es", { numeric: true });
}

export function resumirLote(
  mes: string,
  movimientos: readonly MovimientoHistorico[],
  extra: { avisos: string[]; faltantes: ResumenLote["faltantes"] },
): ResumenLote {
  const porClase = Object.fromEntries(CLASES_HISTORICO.map((c) => [c, 0])) as Record<ClaseHistorico, number>;
  const rubros = new Map<string, TotalRubro>();
  let ingresosEfectivo = 0;
  let ingresosDigital = 0;
  let egresosLibro = 0;
  for (const m of movimientos) {
    porClase[m.clase] += m.centavos;
    const k = `${m.clase}|${m.rubroCodigo ?? ""}`;
    const t = rubros.get(k) ?? { codigo: m.rubroCodigo, nombre: m.rubroNombre ?? "Sin clasificar", clase: m.clase, centavos: 0, cantidad: 0, estimadoCentavos: 0 };
    t.centavos += m.centavos;
    t.cantidad += 1;
    if (m.estimado) t.estimadoCentavos += m.centavos;
    rubros.set(k, t);
    if (m.clase === "INGRESO") {
      if (m.medio === "EFECTIVO") ingresosEfectivo += m.centavos;
      if (m.medio === "DIGITAL") ingresosDigital += m.centavos;
    }
    if (!m.estimado && (m.clase === "COSTO_VARIABLE" || m.clase === "GASTO_FIJO" || m.clase === "RETIRO_DUENO")) egresosLibro += m.centavos;
  }
  const estimados = movimientos
    .filter((m) => m.estimado)
    .map((m) => ({ concepto: m.conceptoNormalizado, rubroCodigo: m.rubroCodigo, centavos: m.centavos }));
  return {
    mes,
    filas: movimientos.filter((m) => !m.estimado).length,
    filasRevisar: movimientos.filter((m) => m.motivos.length > 0).length,
    ingresosCentavos: porClase.INGRESO,
    ingresosEfectivoCentavos: ingresosEfectivo,
    ingresosDigitalCentavos: ingresosDigital,
    porClase,
    porRubro: [...rubros.values()].sort(ordenRubro),
    egresosLibroCentavos: egresosLibro,
    estimados,
    estimadosCentavos: estimados.reduce((s, e) => s + e.centavos, 0),
    resultadoCentavos: porClase.INGRESO + porClase.COSTO_VARIABLE + porClase.GASTO_FIJO + porClase.SIN_CLASIFICAR,
    avisos: extra.avisos,
    faltantes: extra.faltantes,
  };
}

export function huellaDeLote(mes: string, movimientos: readonly MovimientoHistorico[]): string {
  const contenido = movimientos.map((m) => [
    m.fecha, m.turno, m.medio, m.conceptoOriginal, m.conceptoNormalizado, m.centavos, m.referencia, m.observacion,
    m.clase, m.rubroCodigo, m.regla, m.origen, m.motivos,
  ]);
  return createHash("sha256").update(JSON.stringify([mes, contenido])).digest("hex");
}

/**
 * Lotes de la importación. `meses` limita qué lotes se devuelven, pero los faltantes y la revisión
 * siempre miran todas las filas (un mes suelto no sabe qué es "recurrente" ni qué es "raro").
 */
export function armarLotes(
  filas: readonly FilaCsv[],
  mapeo: MapeoHistorico | MapeoValidado,
  opciones: { meses?: readonly string[]; revision?: OpcionesRevision } = {},
): LoteArmado[] {
  const clasificadas = clasificarTodo(filas, mapeo, opciones.revision);
  const porMes = new Map<string, MovimientoHistorico[]>();
  for (const m of clasificadas) {
    const mes = mesDeFecha(m.fecha);
    porMes.set(mes, [...(porMes.get(mes) ?? []), m]);
  }
  const todos = mesesDe(filas);
  const historia: PresenciaGasto[] = [];
  const lotes: LoteArmado[] = [];
  for (const mes of todos) {
    const delCsv = (porMes.get(mes) ?? []).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.fila ?? 0) - (b.fila ?? 0));
    const estimados = estimadosDelMes(mes, mapeo, delCsv);
    const movimientos = [...delCsv, ...estimados].map((m, i) => ({ ...m, orden: i }));
    const presentes = movimientos.map(presencia);
    if (!opciones.meses || opciones.meses.includes(mes)) {
      const faltantes = faltantesRecurrentes(mes, historia, presentes);
      const resumen = resumirLote(mes, movimientos, { avisos: avisosDelMes(mes, mapeo), faltantes });
      lotes.push({ mes, movimientos, resumen, huella: huellaDeLote(mes, movimientos) });
    }
    historia.push(...presentes);
  }
  return lotes;
}
