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

/** Nombre de archivo de un librito dentro del lote: «001 - 5º A - Alsina Justo.pdf». */
export function nombreDeArchivo(posicion: number, libro: LibritoEnProduccion, total: number): string {
  const ancho = Math.max(3, String(total).length);
  const limpio = (s: string) =>
    s
      .normalize("NFC")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const partes = [String(posicion).padStart(ancho, "0"), limpio(libro.curso), limpio(libro.alumno)].filter(Boolean);
  const base = partes.join(" - ").slice(0, 120) || `${posicion}`;
  return `${base} (diseño ${libro.id}).pdf`;
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
export const MAX_LIBRITOS_POR_PDF_UNICO = 40;
