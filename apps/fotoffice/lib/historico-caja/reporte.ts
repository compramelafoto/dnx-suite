/**
 * Informe de la corrida en seco de la importación histórica (Markdown). Módulo PURO.
 *
 * Sirve para revisar ANTES de escribir nada: totales por año y por mes, control contra un resumen
 * de referencia (si lo hay), estimados, faltantes y filas para revisar.
 */
import { formatMinorArs } from "@/lib/membership/money";
import { filasAnaliticasDeLotes, promedioFijos, puntoDeEquilibrio } from "./analitica";
import { ETIQUETA_CLASE, ETIQUETA_MOTIVO, type LoteArmado } from "./tipos";

export type ReferenciaMes = { ingresosCentavos: number; egresosCentavos: number };

export type TotalAnio = {
  anio: string;
  meses: number;
  ingresosCentavos: number;
  egresosLibroCentavos: number;
  estimadosCentavos: number;
  internosCentavos: number;
  resultadoCentavos: number;
  filasRevisar: number;
};

export function totalesPorAnio(lotes: readonly LoteArmado[]): TotalAnio[] {
  const anios = new Map<string, TotalAnio>();
  for (const l of lotes) {
    const anio = l.mes.slice(0, 4);
    const t = anios.get(anio) ?? { anio, meses: 0, ingresosCentavos: 0, egresosLibroCentavos: 0, estimadosCentavos: 0, internosCentavos: 0, resultadoCentavos: 0, filasRevisar: 0 };
    const r = l.resumen;
    t.meses += 1;
    t.ingresosCentavos += r.ingresosCentavos;
    t.egresosLibroCentavos += r.egresosLibroCentavos;
    t.estimadosCentavos += r.estimadosCentavos;
    t.internosCentavos += r.porClase.MOVIMIENTO_INTERNO;
    t.resultadoCentavos += r.resultadoCentavos;
    t.filasRevisar += r.filasRevisar;
    anios.set(anio, t);
  }
  return [...anios.values()].sort((a, b) => a.anio.localeCompare(b.anio));
}

const $ = formatMinorArs;

function control(l: LoteArmado, ref: ReferenciaMes | undefined): { texto: string; ok: boolean | null } {
  if (!ref) return { texto: "—", ok: null };
  const di = l.resumen.ingresosCentavos - ref.ingresosCentavos;
  const de = l.resumen.egresosLibroCentavos - ref.egresosCentavos;
  if (di === 0 && de === 0) return { texto: "OK", ok: true };
  const partes = [di !== 0 ? `ingresos ${$(di)}` : null, de !== 0 ? `egresos ${$(de)}` : null].filter(Boolean);
  return { texto: `DIFERENCIA (${partes.join("; ")})`, ok: false };
}

export function reporteEnSeco(
  lotes: readonly LoteArmado[],
  opciones: { referencia?: ReadonlyMap<string, ReferenciaMes>; generado: string; maxFilasRevisar?: number; mesActual?: string },
): string {
  const ref = opciones.referencia;
  const max = opciones.maxFilasRevisar ?? 15;
  const out: string[] = [];
  out.push("# Importación histórica de Caja — corrida en seco", "");
  out.push(`Generado el ${opciones.generado}. No se escribió nada en ninguna base.`, "");

  const controles = lotes.map((l) => control(l, ref?.get(l.mes)));
  if (!ref) out.push("Control: sin referencia (no se comparó contra un resumen mensual).", "");
  else {
    const malos = controles.filter((c) => c.ok === false).length;
    const comparados = controles.filter((c) => c.ok !== null).length;
    out.push(
      malos === 0
        ? `Control contra el resumen de referencia: los ${comparados} meses coinciden en ingresos y egresos del libro.`
        : `Control contra el resumen de referencia: ${malos} de ${comparados} meses no coinciden.`,
      "",
    );
  }

  out.push("## Totales por año", "");
  out.push("| Año | Meses | Ingresos | Egresos del libro | Fijos estimados | Movimientos internos | Resultado | Filas para revisar |");
  out.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const t of totalesPorAnio(lotes)) {
    out.push(`| ${t.anio} | ${t.meses} | ${$(t.ingresosCentavos)} | ${$(t.egresosLibroCentavos)} | ${$(t.estimadosCentavos)} | ${$(t.internosCentavos)} | ${$(t.resultadoCentavos)} | ${t.filasRevisar} |`);
  }
  out.push("", "Resultado = ingresos + costos variables + gastos fijos (anotados y estimados) + sin clasificar. El retiro del dueño va aparte y los movimientos internos no cuentan.", "");

  out.push("## Mes por mes", "");
  out.push("| Mes | Filas | Ingresos | Control | Egresos del libro | Fijos estimados | Gastos fijos totales | Internos | Resultado | Revisar | Avisos |");
  out.push("|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---|");
  lotes.forEach((l, i) => {
    const r = l.resumen;
    out.push(
      `| ${l.mes} | ${r.filas} | ${$(r.ingresosCentavos)} | ${controles[i].texto} | ${$(r.egresosLibroCentavos)} | ${$(r.estimadosCentavos)} | ${$(r.porClase.GASTO_FIJO)} | ${$(r.porClase.MOVIMIENTO_INTERNO)} | ${$(r.resultadoCentavos)} | ${r.filasRevisar} | ${r.avisos.join("; ") || "—"} |`,
    );
  });
  out.push("");

  if (lotes.length > 0) {
    const filas = filasAnaliticasDeLotes(lotes);
    const mesActual = opciones.mesActual ?? lotes[lotes.length - 1].mes;
    const incompletos = new Set(lotes.filter((l) => l.resumen.avisos.length > 0).map((l) => l.mes));
    const p = promedioFijos(filas, { mesActual, incompletos });
    const enMeses = filas.filter((f) => p.meses.includes(f.mes));
    const ingresos = enMeses.filter((f) => f.clase === "INGRESO").reduce((s, f) => s + f.centavos, 0) / p.meses.length;
    const variables = enMeses.filter((f) => f.clase === "COSTO_VARIABLE").reduce((s, f) => s + f.centavos, 0) / p.meses.length;
    const pe = puntoDeEquilibrio({ fijosMensualesCentavos: p.promedioCentavos, retiroMensualCentavos: 0, ingresosCentavos: Math.round(ingresos), costosVariablesCentavos: Math.round(variables) });
    out.push("## Analítica (muestra)", "");
    out.push(`- Promedio real de gastos fijos de ${p.meses.join(", ")}: **${$(p.promedioCentavos)}** por mes${p.incluyeEstimados ? " (incluye estimados)" : ""}.`);
    if (p.mesesSinDatos.length) out.push(`- Meses sin datos: ${p.mesesSinDatos.join(", ")}.`);
    if (p.mesesIncompletos.length) out.push(`- Meses con gastos fijos incompletos: ${p.mesesIncompletos.join(", ")}.`);
    out.push(`- Ingresos promedio de esos meses: ${$(Math.round(ingresos))}; costos variables: ${$(Math.round(-variables))}.`);
    out.push(
      `- Punto de equilibrio (sin retiro del dueño, que todavía no está declarado): hay que cubrir ${$(pe.contribucionNecesariaCentavos)} por mes` +
        (pe.ventasNecesariasCentavos !== null ? `, o sea vender ${$(pe.ventasNecesariasCentavos)} con un margen de contribución del ${Math.round((pe.margenContribucion ?? 0) * 1000) / 10} %.` : "."),
      "",
    );
  }

  out.push("## Detalle de cada mes", "");
  for (const l of lotes) {
    const r = l.resumen;
    out.push(`### ${l.mes}`, "");
    if (r.avisos.length) out.push(`> ${r.avisos.join(" · ")}`, "");
    out.push(`Ingresos: ${$(r.ingresosCentavos)} (efectivo ${$(r.ingresosEfectivoCentavos)}, digital ${$(r.ingresosDigitalCentavos)}).`, "");
    out.push("| Clase | Rubro | Movimientos | Importe | Estimado |", "|---|---|---:|---:|---:|");
    for (const t of r.porRubro) {
      out.push(`| ${ETIQUETA_CLASE[t.clase]} | ${t.codigo ? `${t.codigo} ` : ""}${t.nombre} | ${t.cantidad} | ${$(t.centavos)} | ${t.estimadoCentavos ? $(t.estimadoCentavos) : "—"} |`);
    }
    out.push("");
    if (r.estimados.length) out.push(`Estimados: ${r.estimados.map((e) => `${e.concepto} ${$(e.centavos)}`).join("; ")}.`, "");
    if (r.faltantes.length) out.push(`No encontramos (se repetía en meses anteriores): ${r.faltantes.map((f) => `${f.concepto} (${f.mesesVistos} de 6 meses)`).join("; ")}.`, "");
    const revisar = l.movimientos.filter((m) => m.motivos.length > 0);
    if (revisar.length) {
      out.push(`Para revisar (${revisar.length}${revisar.length > max ? `, se muestran ${max}` : ""}):`, "");
      for (const m of revisar.slice(0, max)) {
        out.push(`- ${m.fecha} · ${m.conceptoOriginal} · ${$(m.centavos)} · ${m.motivos.map((x) => ETIQUETA_MOTIVO[x]).join(", ")}${m.referencia ? ` · ${m.referencia}` : ""}`);
      }
      out.push("");
    }
  }
  return out.join("\n");
}
