/**
 * La cola de obras del visor: en qué estado está cada una, cuáles se muestran
 * y cómo se pasa de una a la siguiente.
 *
 * Todo puro y sin base de datos, porque es lo que decide qué ve el jurado
 * mientras califica y tiene que poder probarse sin montar media plataforma.
 */

export type ObraEnElVisor = {
  entryId: string;
  snapshotId: string | null;
  codigo: string;
  consignaNumero: number | null;
  consignaTitulo: string | null;
  /**
   * La consigna completa, sólo mientras se arma la cola.
   *
   * No viaja al navegador pegada a cada obra: son 170 copias del mismo
   * párrafo. Al cliente va una vez, en la lista de consignas.
   */
  consignaTexto?: string;
  previewUrl: string | null;
  /** Lo que ya puso este jurado, por clave de criterio. */
  notas: Record<string, number>;
  /**
   * La nota al margen del jurado sobre esta obra. Opcional y privada: la lee
   * la organización, nunca quien la fotografió.
   */
  comentario: string;
  /** Ya la envió: no se puede cambiar. */
  enviada: boolean;
};

export type EstadoDeObra = "SIN_CALIFICAR" | "SIN_TERMINAR" | "CALIFICADA";

export type FiltroDelVisor = "TODAS" | "ME_FALTAN" | "TERMINADAS" | "A_MEDIAS";

/**
 * Los filtros preguntan "¿me falta algo?", no "¿toqué algo?".
 *
 * Con un filtro de "sin calificar", la primera nota sacaba la foto de la lista
 * y el visor saltaba a la siguiente: quedaba una foto a medio calificar
 * escondida detrás del filtro, y el jurado ni se enteraba. Una foto se va de
 * "me faltan" recién cuando tiene **todos** los criterios puestos.
 */
export const FILTROS_DEL_VISOR: Array<{
  id: FiltroDelVisor;
  nombre: string;
  detalle: string;
}> = [
  {
    id: "TODAS",
    nombre: "Todas",
    detalle: "Las que te tocaron en esta consigna",
  },
  {
    id: "ME_FALTAN",
    nombre: "Me faltan",
    detalle: "Sin todas las calificaciones puestas, las haya tocado o no",
  },
  {
    id: "TERMINADAS",
    nombre: "Completas",
    detalle: "Con todas las calificaciones puestas",
  },
  {
    id: "A_MEDIAS",
    nombre: "Empezadas",
    detalle: "Con alguna calificación y alguna faltando: así no cuentan",
  },
];

/**
 * Una obra está calificada cuando tiene **todos** los criterios puestos.
 *
 * "Sin terminar" no es un detalle: esas obras no cuentan para el resultado y el
 * jurado cree que las hizo. Por eso se cuentan aparte y se avisan dos veces.
 */
export function estadoDeLaObra(
  obra: ObraEnElVisor,
  criterios: string[],
): EstadoDeObra {
  if (criterios.length === 0) return "SIN_CALIFICAR";
  const puestas = criterios.filter(
    (k) => typeof obra.notas[k] === "number",
  ).length;
  if (puestas === 0) return "SIN_CALIFICAR";
  return puestas === criterios.length ? "CALIFICADA" : "SIN_TERMINAR";
}

export type ResumenDeLaCola = {
  total: number;
  calificadas: number;
  sinCalificar: number;
  sinTerminar: number;
  /** Lo que le queda por hacer: sin calificar más sin terminar. */
  faltan: number;
};

export function resumenDeLaCola(
  obras: ObraEnElVisor[],
  criterios: string[],
): ResumenDeLaCola {
  let calificadas = 0;
  let sinCalificar = 0;
  let sinTerminar = 0;

  for (const o of obras) {
    const estado = estadoDeLaObra(o, criterios);
    if (estado === "CALIFICADA") calificadas += 1;
    else if (estado === "SIN_TERMINAR") sinTerminar += 1;
    else sinCalificar += 1;
  }

  return {
    total: obras.length,
    calificadas,
    sinCalificar,
    sinTerminar,
    faltan: sinCalificar + sinTerminar,
  };
}

/**
 * Qué obras se ven ahora: las de **una** consigna, con el filtro puesto.
 *
 * Trabajar una consigna por vez es lo que hace comparable una nota: 27 fotos de
 * "Sombras" seguidas se comparan entre sí, mezcladas con las de "Color" no.
 */
export function obrasVisibles(
  obras: ObraEnElVisor[],
  criterios: string[],
  vista: { consigna: number | null; filtro: FiltroDelVisor },
): ObraEnElVisor[] {
  return obras.filter((o) => {
    if (vista.consigna !== null && o.consignaNumero !== vista.consigna)
      return false;
    if (vista.filtro === "TODAS") return true;

    const estado = estadoDeLaObra(o, criterios);
    if (vista.filtro === "ME_FALTAN") return estado !== "CALIFICADA";
    if (vista.filtro === "TERMINADAS") return estado === "CALIFICADA";
    return estado === "SIN_TERMINAR";
  });
}

/**
 * La obra siguiente o la anterior, dando la vuelta al llegar al borde.
 *
 * Si la actual ya no está en la lista —porque el filtro la sacó al calificarla—
 * se empieza por la primera en vez de quedarse sin nada que mostrar.
 */
export function laSiguiente(
  lista: ObraEnElVisor[],
  entryIdActual: string,
  paso: 1 | -1,
): ObraEnElVisor | null {
  if (lista.length === 0) return null;
  const pos = lista.findIndex((o) => o.entryId === entryIdActual);
  if (pos === -1) return lista[0] ?? null;
  const siguiente = (pos + paso + lista.length) % lista.length;
  return lista[siguiente] ?? null;
}
