/**
 * Lee las tablas de avance de los documentos.
 *
 * Puro: recibe texto, devuelve etapas. Sin disco y sin consola, para poder probarlo.
 */

/** Los cuatro estados. Cualquier otra cosa en la celda es un error del documento. */
export const ESTADOS = ["✅", "🟡", "⬜", "🚫"];

const MARCA = /<!--\s*avance:\s*(.+?)\s*-->/;

/**
 * Cuenta una columna.
 *
 * `🚫` no entra en el denominador: una tarea que depende de un tercero no debería bajar
 * el porcentaje de nuestro trabajo, pero tampoco subirlo.
 *
 * Sin tareas contables devuelve `null`, **no cero**. No tener el dato es distinto de
 * tener el dato en cero, y confundirlos es cómo un tablero empieza a mentir.
 */
export function porcentaje(estados) {
  const cuentan = estados.filter((e) => e !== "🚫");
  if (cuentan.length === 0) return null;

  // Un 🟡 vale medio. Es arbitrario, pero la alternativa —que valga cero— hace que una
  // etapa casi terminada se vea igual que una sin empezar.
  const puntos = cuentan.reduce((s, e) => s + (e === "✅" ? 1 : e === "🟡" ? 0.5 : 0), 0);
  return Math.round((puntos / cuentan.length) * 100);
}

/**
 * Extrae las etapas de un documento.
 *
 * Una etapa es la marca `<!-- avance: … -->` seguida de una tabla. Se cortan en la marca
 * siguiente o al terminar la tabla: así un documento puede tener varias.
 */
export function leerEtapas(texto) {
  const lineas = texto.split("\n");
  const etapas = [];
  let actual = null;

  for (const linea of lineas) {
    const marca = linea.match(MARCA);
    if (marca) {
      actual = { nombre: marca[1], tareas: [] };
      etapas.push(actual);
      continue;
    }
    if (!actual) continue;

    const celdas = filaDeTabla(linea);
    if (!celdas) {
      // Una línea en blanco no corta la etapa: entre la marca y la tabla suele haber una.
      if (linea.trim() === "" || linea.trim().startsWith("|")) continue;
      actual = null;
      continue;
    }

    const [id, tarea, codigo, produccion, ...resto] = celdas;
    if (!ESTADOS.includes(codigo) || !ESTADOS.includes(produccion)) continue;

    actual.tareas.push({
      id,
      tarea,
      codigo,
      produccion,
      nota: (resto[0] ?? "").trim(),
    });
  }

  return etapas.filter((e) => e.tareas.length > 0);
}

function filaDeTabla(linea) {
  const t = linea.trim();
  if (!t.startsWith("|") || !t.endsWith("|")) return null;
  // La fila de guiones que separa el encabezado no es una tarea.
  if (/^\|[\s:|-]+\|$/.test(t)) return null;
  return t.slice(1, -1).split("|").map((c) => c.trim());
}

/** Las tareas que no están terminadas y no tienen nota. Un 🟡 sin explicar es un ⬜. */
export function sinExplicar(etapas) {
  const salida = [];
  for (const e of etapas) {
    for (const t of e.tareas) {
      const incompleta = t.codigo !== "✅" || t.produccion !== "✅";
      if (incompleta && !t.nota) salida.push(`${e.nombre} / ${t.id}`);
    }
  }
  return salida;
}

/** Resume una lista de etapas en los dos porcentajes. */
export function resumir(etapas) {
  const todas = etapas.flatMap((e) => e.tareas);
  return {
    tareas: todas.length,
    codigo: porcentaje(todas.map((t) => t.codigo)),
    produccion: porcentaje(todas.map((t) => t.produccion)),
  };
}
