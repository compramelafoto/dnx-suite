/**
 * Qué decirle al organizador después de asignar en tanda.
 *
 * Una tanda puede terminar de varias maneras y callarse las omisiones sería
 * lo peor: el organizador creería que asignó seis categorías cuando asignó
 * cuatro. Los dos motivos de omisión se cuentan por separado porque se
 * arreglan distinto — un duplicado ya está resuelto, una categoría donde el
 * jurado compite necesita otro jurado.
 */

export type ResultadoDeAsignacion = {
  created: number;
  skippedExisting: number;
  skippedCompite: number;
};

function asignaciones(n: number): string {
  return n === 1 ? "1 asignación" : `${n} asignaciones`;
}

function categorias(n: number): string {
  return n === 1 ? "1 categoría" : `${n} categorías`;
}

export function mensajeDeAsignacion(r: ResultadoDeAsignacion): string {
  const omisiones: string[] = [];
  if (r.skippedExisting > 0) {
    omisiones.push(`${categorias(r.skippedExisting)} que ya tenían asignación`);
  }
  if (r.skippedCompite > 0) {
    omisiones.push(
      `${categorias(r.skippedCompite)} donde este jurado compite con obra propia`,
    );
  }

  if (r.created === 0 && omisiones.length === 0) {
    return "No se creó ninguna asignación.";
  }

  if (r.created === 0) {
    return `No se creó ninguna asignación: se omitieron ${omisiones.join(" y ")}.`;
  }

  if (omisiones.length === 0) {
    return `Se ${r.created === 1 ? "creó" : "crearon"} ${asignaciones(r.created)}.`;
  }

  return `Se ${r.created === 1 ? "creó" : "crearon"} ${asignaciones(r.created)}. Se omitieron ${omisiones.join(" y ")}.`;
}
