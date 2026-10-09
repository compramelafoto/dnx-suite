/**
 * CSV de Informes (etapa 6). Módulo PURO: arma el texto con `armarCsvExcel` (el mismo de los listados:
 * punto y coma, BOM, protección contra fórmulas). Los importes salen en pesos con coma decimal.
 */
import { armarCsvExcel } from "@/lib/listado/csv";
import type { ColumnaExport } from "@/lib/listado/tipos";
import type { FilaDetalle } from "./detalle";
import { fechaLarga } from "./detalle";
import { LEYENDA_MONOTRIBUTO } from "./constantes";
import type { FlujoProyectado } from "./flujo";
import type { ResultadoMonotributo } from "./monotributo";
import { etiquetaMes } from "./periodos";
import type { FilaRubro, MatrizResultados } from "./resultados";

export const INFORMES_CSV = ["resultados", "resultados-detalle", "flujo", "flujo-detalle", "monotributo"] as const;
export type InformeCsv = (typeof INFORMES_CSV)[number];

export function esInformeCsv(v: string): v is InformeCsv {
  return (INFORMES_CSV as readonly string[]).includes(v);
}

type FilaMatriz = { bloque: string; rubro: string; valores: number[]; total: number };

function etiquetaRubro(f: FilaRubro): string {
  return `${f.codigo ? `${f.codigo} ` : ""}${f.nombre}${f.inactivo ? " (inactivo)" : ""}`;
}

/** Matriz de Resultados: una fila por rubro (los hijos debajo de su padre), total por bloque y resultado. */
export function csvDeResultados(m: MatrizResultados): string {
  const filas: FilaMatriz[] = [];
  for (const b of m.bloques) {
    if (b.filas.length === 0 && b.porMes.every((v) => v === 0)) continue;
    for (const f of b.filas) {
      const conHijos = f.hijos.length > 0;
      filas.push({ bloque: b.titulo, rubro: conHijos ? `${etiquetaRubro(f)} (subtotal)` : etiquetaRubro(f), valores: f.porMes, total: f.total });
      for (const h of f.hijos) filas.push({ bloque: b.titulo, rubro: `  ${etiquetaRubro(h)}`, valores: h.porMes, total: h.total });
    }
    filas.push({ bloque: b.titulo, rubro: `Total ${b.titulo.toLowerCase()}`, valores: b.porMes, total: b.total });
  }
  filas.push({ bloque: "Resultado", rubro: "Resultado", valores: m.resultado.porMes, total: m.resultado.total });
  const columnas: ColumnaExport<FilaMatriz>[] = [
    { titulo: "Bloque", tipo: "texto", valor: (f) => f.bloque },
    { titulo: "Rubro", tipo: "texto", valor: (f) => f.rubro },
    ...m.meses.map((mes, i): ColumnaExport<FilaMatriz> => ({ titulo: etiquetaMes(mes), tipo: "importe", valor: (f) => f.valores[i] })),
    { titulo: "Total", tipo: "importe", valor: (f) => f.total },
  ];
  return armarCsvExcel(columnas, filas);
}

/** Desglose de una celda (Resultados o Flujo): todas las filas, con el total al final. */
export function csvDeDetalle(filas: readonly FilaDetalle[], total: number): string {
  type F = { fecha: string; origen: string; contacto: string; descripcion: string; centavos: number };
  const datos: F[] = filas.map((f) => ({ fecha: fechaLarga(f.fecha), origen: f.origen, contacto: f.contacto ?? "", descripcion: f.descripcion, centavos: f.centavos }));
  datos.push({ fecha: "", origen: "Total", contacto: "", descripcion: "", centavos: total });
  const columnas: ColumnaExport<F>[] = [
    { titulo: "Fecha", tipo: "texto", valor: (f) => f.fecha },
    { titulo: "Origen", tipo: "texto", valor: (f) => f.origen },
    { titulo: "Contacto", tipo: "texto", valor: (f) => f.contacto },
    { titulo: "Descripción", tipo: "texto", valor: (f) => f.descripcion },
    { titulo: "Importe", tipo: "importe", valor: (f) => f.centavos },
  ];
  return armarCsvExcel(columnas, datos);
}

/** Flujo proyectado: fila "Hoy", una por período y "Sin fecha". */
export function csvDeFlujo(f: FlujoProyectado): string {
  type F = { periodo: string; desde: string; hasta: string; cobrar: number | null; pagar: number | null; neto: number | null; acumulado: number | null; bajo: string };
  const datos: F[] = [
    { periodo: "Hoy", desde: "", hasta: "", cobrar: f.hoy.vencidoCobrar, pagar: f.hoy.vencidoPagar, neto: f.hoy.vencidoCobrar - f.hoy.vencidoPagar, acumulado: f.hoy.acumulado, bajo: f.hoy.bajoMinimo ? "Sí" : "" },
    ...f.filas.map((x) => ({ periodo: x.etiqueta, desde: fechaLarga(x.desde), hasta: fechaLarga(x.hasta), cobrar: x.porCobrar, pagar: x.porPagar, neto: x.neto, acumulado: x.acumulado, bajo: x.bajoMinimo ? "Sí" : "" })),
    { periodo: "Sin fecha", desde: "", hasta: "", cobrar: null, pagar: f.sinFecha.porPagar, neto: null, acumulado: null, bajo: "" },
  ];
  const columnas: ColumnaExport<F>[] = [
    { titulo: "Período", tipo: "texto", valor: (x) => x.periodo },
    { titulo: "Desde", tipo: "texto", valor: (x) => x.desde },
    { titulo: "Hasta", tipo: "texto", valor: (x) => x.hasta },
    { titulo: "Por cobrar", tipo: "importe", valor: (x) => x.cobrar },
    { titulo: "Por pagar", tipo: "importe", valor: (x) => x.pagar },
    { titulo: "Neto", tipo: "importe", valor: (x) => x.neto },
    { titulo: "Saldo acumulado", tipo: "importe", valor: (x) => x.acumulado },
    { titulo: "Por debajo del mínimo", tipo: "texto", valor: (x) => x.bajo },
  ];
  return armarCsvExcel(columnas, datos);
}

/** Monotributo: cobrado mes a mes, total, tope y porcentaje. */
export function csvDeMonotributo(r: ResultadoMonotributo, tope: number | null, categoria: string | null): string {
  type F = { concepto: string; importe: number | null; porcentaje: string };
  const datos: F[] = [
    ...r.meses.map((m) => ({ concepto: `Cobrado ${etiquetaMes(m.mes)}`, importe: m.centavos, porcentaje: "" })),
    { concepto: "Total cobrado en 12 meses", importe: r.total, porcentaje: r.porcentaje === null ? "" : `${String(r.porcentaje).replace(".", ",")} %` },
    { concepto: `Tope anual${categoria ? ` (categoría ${categoria})` : ""}`, importe: tope, porcentaje: "" },
    { concepto: "Falta para el tope", importe: r.falta, porcentaje: "" },
    { concepto: LEYENDA_MONOTRIBUTO, importe: null, porcentaje: "" },
  ];
  const columnas: ColumnaExport<F>[] = [
    { titulo: "Concepto", tipo: "texto", valor: (x) => x.concepto },
    { titulo: "Importe", tipo: "importe", valor: (x) => x.importe },
    { titulo: "Porcentaje del tope", tipo: "texto", valor: (x) => x.porcentaje },
  ];
  return armarCsvExcel(columnas, datos);
}
