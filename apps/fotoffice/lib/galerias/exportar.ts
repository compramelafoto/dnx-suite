/**
 * Exportar la selección de un cliente (etapa 7). Módulo PURO.
 *
 * - Nombres de archivo SIN extensión: Lightroom compara contra el nombre (el RAW tiene otra extensión).
 * - En bloques de hasta 1.000 caracteres: es lo que acepta el campo de búsqueda de Lightroom.
 *   Lightroom separa con ", " y el Explorador de Windows y el Finder con " OR ".
 * - Además un CSV (Excel) con el nombre de cada foto y los comentarios.
 */
import { armarCsvExcel } from "@/lib/listado/csv";
import type { ColumnaExport } from "@/lib/listado/tipos";
import { ordenarPorNombre } from "./orden";

export const MAX_CARACTERES_BLOQUE = 1000;
export const SEPARADOR_LIGHTROOM = ", ";
export const SEPARADOR_WINDOWS = " OR ";

/** El nombre sin la extensión (sólo la última, de hasta 5 letras o números): "IMG_0012.CR2" → "IMG_0012". */
export function nombreSinExtension(fileName: string): string {
  const nombre = fileName.trim();
  const sinExt = nombre.replace(/(?<=.)\.[A-Za-z0-9]{1,5}$/, "");
  return sinExt.length > 0 ? sinExt : nombre;
}

/**
 * Parte los nombres en bloques de hasta `max` caracteres (contando los separadores). Un nombre nunca se
 * corta: si uno solo supera el máximo va en un bloque propio.
 */
export function armarBloques(nombres: readonly string[], separador: string, max: number = MAX_CARACTERES_BLOQUE): string[] {
  const bloques: string[] = [];
  let actual = "";
  for (const n of nombres) {
    if (actual === "") {
      actual = n;
    } else if (actual.length + separador.length + n.length <= max) {
      actual += separador + n;
    } else {
      bloques.push(actual);
      actual = n;
    }
  }
  if (actual !== "") bloques.push(actual);
  return bloques;
}

export type FotoParaExportar = { fileName: string };

export type SeleccionExportada = {
  /** Cantidad de nombres distintos exportados. */
  total: number;
  /** Nombres sin extensión, en orden natural y sin repetir. */
  nombres: string[];
  lightroom: string[];
  windows: string[];
};

/** Los nombres elegidos, en orden natural y sin repetir (dos fotos con el mismo nombre se buscan una vez). */
export function nombresParaExportar(fotos: readonly FotoParaExportar[]): string[] {
  const vistos = new Set<string>();
  const nombres: string[] = [];
  for (const f of ordenarPorNombre(fotos)) {
    const n = nombreSinExtension(f.fileName);
    const clave = n.toLowerCase();
    if (n === "" || vistos.has(clave)) continue;
    vistos.add(clave);
    nombres.push(n);
  }
  return nombres;
}

export function exportarSeleccion(fotos: readonly FotoParaExportar[]): SeleccionExportada {
  const nombres = nombresParaExportar(fotos);
  return {
    total: nombres.length,
    nombres,
    lightroom: armarBloques(nombres, SEPARADOR_LIGHTROOM),
    windows: armarBloques(nombres, SEPARADOR_WINDOWS),
  };
}

export type FilaCsvSeleccion = { fileName: string; comentarios: readonly string[] };

const COLUMNAS_CSV: ColumnaExport<FilaCsvSeleccion>[] = [
  { titulo: "Foto", tipo: "texto", valor: (f) => nombreSinExtension(f.fileName) },
  { titulo: "Archivo", tipo: "texto", valor: (f) => f.fileName },
  { titulo: "Comentarios", tipo: "texto", valor: (f) => f.comentarios.map((c) => c.replace(/\s*\n\s*/g, " ")).join(" | ") },
];

/** CSV para Excel (separado por punto y coma, con BOM) con una fila por foto elegida, en orden natural. */
export function csvDeSeleccion(filas: readonly FilaCsvSeleccion[]): string {
  return armarCsvExcel(COLUMNAS_CSV, ordenarPorNombre(filas));
}
