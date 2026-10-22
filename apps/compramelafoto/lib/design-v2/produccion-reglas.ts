/**
 * Reglas puras de la producción de librititos (lotes de impresión, impresos, entregados).
 * Sin base de datos, para poder probarlas.
 */

export type LibritoEnProduccion = {
  id: number;
  alumno: string;
  curso: string;
  colegio: string;
};

/** Orden de impresión: por colegio, curso y alumno, para que la imprenta los entregue agrupados. */
export function ordenDeImpresion<T extends LibritoEnProduccion>(libros: readonly T[]): T[] {
  const col = new Intl.Collator("es", { sensitivity: "base", numeric: true });
  return [...libros].sort(
    (a, b) =>
      col.compare(a.colegio, b.colegio) ||
      col.compare(a.curso, b.curso) ||
      col.compare(a.alumno, b.alumno) ||
      a.id - b.id,
  );
}

/** Saca lo que no puede ir en un nombre de archivo (Windows, macOS, imprentas) y espacios de más. */
function limpioParaArchivo(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Windows no admite carpetas ni archivos que terminen en punto o espacio.
    .replace(/[. ]+$/, "");
}

/**
 * Curso para el nombre de archivo: «7º A» → «7 A», «5.º B» → «5 B». El «º» (y «°», «ª») se ve y se
 * ordena distinto según el sistema, y algunos descompresores viejos de Windows lo rompen.
 */
export function cursoParaArchivo(curso: string): string {
  return limpioParaArchivo(curso.replace(/\s*\.?\s*[º°ª]\s*/g, " "));
}

/**
 * El comienzo de todos los nombres de un trabajo: «001 - 7 A - Celoria Pedro».
 *
 * El número de orden lleva siempre el mismo ancho (3 dígitos, o más si el lote es más grande), así
 * el orden alfabético de cualquier sistema (Finder, Explorador de Windows, la imprenta) es el orden
 * de impresión. Sin posición (descarga suelta de un diseño), sólo curso y alumno.
 */
export function prefijoDeTrabajo(posicion: number | null, libro: LibritoEnProduccion, total: number): string {
  const ancho = Math.max(3, String(Math.max(total, posicion ?? 0)).length);
  const partes = [
    posicion == null ? "" : String(posicion).padStart(ancho, "0"),
    cursoParaArchivo(libro.curso),
    limpioParaArchivo(libro.alumno),
  ].filter(Boolean);
  const base = limpioParaArchivo(partes.join(" - ").slice(0, 120));
  return base || (posicion == null ? `Diseño ${libro.id}` : String(posicion));
}

/**
 * Nombre de un trabajo, sin extensión: «001 - 7 A - Celoria Pedro (diseño 123)». El id del diseño
 * separa a dos alumnos con el mismo nombre aunque los archivos se mezclen entre lotes.
 */
export function nombreDeTrabajo(posicion: number | null, libro: LibritoEnProduccion, total: number): string {
  return `${prefijoDeTrabajo(posicion, libro, total)} (diseño ${libro.id})`;
}

/** Nombre de archivo de un librito dentro del lote: «001 - 7 A - Celoria Pedro (diseño 123).pdf». */
export function nombreDeArchivo(posicion: number, libro: LibritoEnProduccion, total: number): string {
  return `${nombreDeTrabajo(posicion, libro, total)}.pdf`;
}

/** Etiquetas que pone el editor solo («Hoja 1»): no dicen qué cara es. */
const ETIQUETA_GENERICA = /^(hoja|p[aá]gina|cara|page)\s*\d*$/i;

/** «Exterior (contratapa + tapa)» → «EXTERIOR (contratapa + tapa)»; null si la etiqueta no dice nada. */
function rotulo(etiqueta: string | undefined): string | null {
  const e = limpioParaArchivo(etiqueta ?? "").slice(0, 60).trim();
  if (!e || ETIQUETA_GENERICA.test(e)) return null;
  const parentesis = e.indexOf(" (");
  const principal = parentesis > 0 ? e.slice(0, parentesis) : e;
  const resto = parentesis > 0 ? e.slice(parentesis) : "";
  return `${principal.toLocaleUpperCase("es")}${resto}`;
}

/**
 * Cómo se llama una cara en el nombre del JPG: «1 EXTERIOR (contratapa + tapa)», «2 INTERIOR».
 * El número va antes del rótulo para que las caras se ordenen solas. Sale de las etiquetas de la
 * plantilla (`metaJson.pageLabels`); si la plantilla no dice nada, «1 Página 1 de 2».
 */
export function nombreDeCara(indice: number, cantidad: number, etiquetas: readonly string[] | null | undefined): string {
  const numero = String(indice + 1).padStart(String(cantidad).length, "0");
  return `${numero} ${rotulo(etiquetas?.[indice]) ?? `Página ${indice + 1} de ${cantidad}`}`;
}

/**
 * Los JPG de un trabajo, uno por cara, todos sueltos en la misma carpeta del lote. Cada nombre
 * empieza con el del trabajo, así las caras quedan juntas y en orden al ordenar por nombre:
 * «001 - 7 A - Celoria Pedro (diseño 123) - 1 EXTERIOR (contratapa + tapa).jpg».
 * Un producto de una sola cara lleva un único JPG con el nombre del trabajo (y su rótulo, si tiene).
 */
export function archivosJpgDeTrabajo(
  posicion: number | null,
  libro: LibritoEnProduccion,
  total: number,
  caras: number,
  etiquetas: readonly string[] | null | undefined,
): string[] {
  const trabajo = nombreDeTrabajo(posicion, libro, total);
  if (caras <= 1) {
    const r = rotulo(etiquetas?.[0]);
    return [r ? `${trabajo} - ${r}.jpg` : `${trabajo}.jpg`];
  }
  return Array.from({ length: caras }, (_, i) => `${trabajo} - ${nombreDeCara(i, caras, etiquetas)}.jpg`);
}

/**
 * Carpeta del lote dentro del ZIP. «Lote 3 · 14/10» tiene una barra: tal cual, el ZIP la abría
 * como dos carpetas («Lote 3 · 14» y adentro «10»).
 */
export function carpetaDelLote(nombre: string): string {
  return limpioParaArchivo(nombre.replace(/[\\/]/g, "-")) || "Lote";
}

/** Archivos de control del lote: empiezan con «000», así quedan primeros al ordenar por nombre. */
export const ARCHIVOS_DE_CONTROL = {
  leeme: "000 - LEEME.txt",
  resumen: "000 - RESUMEN DEL LOTE.pdf",
  control: "000 - CONTROL DE ARCHIVOS.txt",
  faltantes: "000 - FALTAN.txt",
} as const;

export type LibritoConJpg = LibritoEnProduccion & {
  /** Claves en R2 de los JPG que se generaron al aprobar, uno por cara y en orden. */
  jpgKeys: readonly string[];
  /** Etiquetas de las caras de la plantilla (`metaJson.pageLabels`). */
  etiquetas: readonly string[] | null;
};

/**
 * Lo que va en el ZIP de JPG de un lote: todos los JPG en una sola carpeta, en orden de
 * impresión. El número de cada trabajo es su lugar en la lista completa (igual que en el resumen y
 * las etiquetas), aunque falte alguno.
 */
export function planDelLoteJpg(
  nombre: string,
  libros: readonly LibritoConJpg[],
): {
  carpeta: string;
  archivos: Array<{ zipPath: string; r2Key: string; nombre: string }>;
  faltantes: string[];
  leeme: string;
} {
  const carpeta = carpetaDelLote(nombre);
  const archivos: Array<{ zipPath: string; r2Key: string; nombre: string }> = [];
  const trabajos: Array<{ colegio: string; archivos: string[] }> = [];
  const faltantes: string[] = [];
  libros.forEach((libro, i) => {
    if (libro.jpgKeys.length === 0) {
      faltantes.push(`${nombreDeTrabajo(i + 1, libro, libros.length)}: sin JPG final`);
      return;
    }
    const nombres = archivosJpgDeTrabajo(i + 1, libro, libros.length, libro.jpgKeys.length, libro.etiquetas);
    trabajos.push({ colegio: libro.colegio, archivos: nombres });
    nombres.forEach((archivo, cara) => {
      archivos.push({ zipPath: `${carpeta}/${archivo}`, r2Key: libro.jpgKeys[cara]!, nombre: archivo });
    });
  });
  return { carpeta, archivos, faltantes, leeme: leemeDelLoteJpg(nombre, trabajos, faltantes) };
}

/** Texto del «000 - LEEME.txt» del ZIP de JPG: cómo está ordenado y qué hay. */
export function leemeDelLoteJpg(
  nombre: string,
  trabajos: ReadonlyArray<{ colegio: string; archivos: readonly string[] }>,
  faltantes: readonly string[],
): string {
  const jpgs = trabajos.reduce((n, t) => n + t.archivos.length, 0);
  const lineas = [
    nombre,
    "",
    `${trabajos.length} ${trabajos.length === 1 ? "trabajo" : "trabajos"} · ${jpgs} JPG para imprenta (300 dpi, sRGB).`,
    "",
    "CÓMO ESTÁ ORDENADO",
    "- Todos los JPG están en esta carpeta. Ordenados por nombre quedan en orden de impresión:",
    "  colegio, curso y alumno.",
    "- Cada nombre empieza con el número de orden del trabajo (el mismo del RESUMEN DEL LOTE y de",
    "  las etiquetas para los sobres), el curso, el alumno y el número de diseño.",
    "- En los libritos, el final del nombre dice la cara: «1 EXTERIOR (contratapa + tapa)» va de un",
    "  lado de la hoja y «2 INTERIOR» del otro. Las caras de un mismo trabajo llevan el mismo número",
    "  de orden y el mismo número de diseño: no juntar caras con números distintos.",
    "- Imprimir cada JPG a su tamaño real (300 dpi), sin escalar ni recortar.",
    "",
    "CONTENIDO",
  ];
  let colegio: string | null = null;
  for (const t of trabajos) {
    if (t.colegio !== colegio) {
      colegio = t.colegio;
      if (colegio) lineas.push("", colegio);
    }
    for (const a of t.archivos) lineas.push(`  ${a}`);
  }
  if (faltantes.length) {
    lineas.push("", "SIN ARCHIVO (no van en este ZIP)");
    for (const f of faltantes) lineas.push(`- ${f}`);
  }
  return lineas.join("\r\n") + "\r\n";
}

/** «Lote 3 · 14/10» con el siguiente número libre entre los lotes del fotógrafo. */
export function nombreDelProximoLote(existentes: readonly string[], fecha: Date): string {
  let mayor = 0;
  for (const n of existentes) {
    const m = /^Lote (\d+)\b/.exec(n);
    if (m) mayor = Math.max(mayor, Number(m[1]));
  }
  const dia = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
  }).format(fecha);
  return `Lote ${mayor + 1} · ${dia}`;
}

/** Texto del alumno a partir de los valores del diseño. */
export function datosDelLibrito(id: number, values: Record<string, string> | undefined | null): LibritoEnProduccion {
  const v = values ?? {};
  const alumno = v["student.lastNameFirst"] || v["student.fullName"] || "";
  return {
    id,
    alumno: alumno.replace(/,/g, "").trim(),
    curso: (v["course.displayName"] ?? "").trim(),
    colegio: (v["school.name"] ?? "").trim(),
  };
}

/** Topes por descarga: el ZIP se arma de a un archivo; el PDF único se arma entero en memoria. */
export const MAX_LIBRITOS_POR_ZIP = 60;
/**
 * El ZIP de JPG pesa más que el de PDF (cada cara es una imagen de 300 dpi sin comprimir de más)
 * y la descarga tiene que terminar dentro de los 5 minutos de la función: menos trabajos por ZIP.
 */
export const MAX_LIBRITOS_POR_ZIP_JPG = 30;
export const MAX_LIBRITOS_POR_PDF_UNICO = 40;
