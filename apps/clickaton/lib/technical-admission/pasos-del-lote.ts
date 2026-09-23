/**
 * Los cuatro pasos de la admisión, en orden y con su estado.
 *
 * Antes eran cinco botones sueltos en una fila, todos encendidos al mismo
 * tiempo y sin decir qué hacía cada uno. El orden importa —el sistema rechaza
 * congelar sin cerrar— pero la pantalla no lo mostraba: había que saberlo de
 * memoria o descubrirlo con un error.
 *
 * Acá se calcula qué paso corresponde ahora, cuáles ya están hechos y cuáles
 * todavía no se pueden. El botón sigue siendo el mismo; lo que cambia es que
 * la pantalla cuenta en qué punto del camino está.
 */

export type EstadoDelLote =
  | "DRAFT"
  | "PROCESSING"
  | "REVIEW_REQUIRED"
  | "READY_TO_CLOSE"
  | "CLOSED"
  | "FROZEN"
  | "CANCELLED";

export type EstadoDelPaso = "HECHO" | "AHORA" | "ESPERA";

export type PasoDelLote = {
  numero: 1 | 2 | 3 | 4;
  titulo: string;
  queHace: string;
  /** Lo que conviene saber antes de apretar. Null cuando no hay nada que aclarar. */
  aclaracion: string | null;
  estado: EstadoDelPaso;
};

export type SituacionDelLote = {
  /** null cuando todavía no se creó ningún lote. */
  estadoDelLote: EstadoDelLote | null;
  /** Entregas confirmadas que todavía no tienen decisión técnica. */
  sinEvaluar: number;
  /** Cuántas espera una mirada humana. */
  requierenRevision: number;
  /** Cuántas quedaron admitidas. */
  admitidas: number;
  /** Cuántas evalúa cada pasada del botón. */
  porTanda: number;
};

/**
 * Cuántas veces hay que apretar "evaluar" para cubrir lo que falta.
 *
 * El botón procesa una tanda por vez. Sin este número, alguien aprieta una vez,
 * ve que quedan fotos sin evaluar y no entiende por qué: fue exactamente lo que
 * pasó con las primeras 100 de la 1ª edición.
 */
export function tandasQueFaltan(sinEvaluar: number, porTanda: number): number {
  if (sinEvaluar <= 0 || porTanda <= 0) return 0;
  return Math.ceil(sinEvaluar / porTanda);
}

const YA_PASO_POR_EVALUACION: EstadoDelLote[] = [
  "PROCESSING",
  "REVIEW_REQUIRED",
  "READY_TO_CLOSE",
  "CLOSED",
  "FROZEN",
];

export function pasosDelLote(s: SituacionDelLote): PasoDelLote[] {
  const hayLote = s.estadoDelLote !== null && s.estadoDelLote !== "CANCELLED";
  const cerrado = s.estadoDelLote === "CLOSED" || s.estadoDelLote === "FROZEN";
  const congelado = s.estadoDelLote === "FROZEN";
  const seEvaluoAlgo =
    s.admitidas > 0 ||
    s.requierenRevision > 0 ||
    (s.estadoDelLote !== null && YA_PASO_POR_EVALUACION.includes(s.estadoDelLote));

  const faltan = tandasQueFaltan(s.sinEvaluar, s.porTanda);

  const paso1: PasoDelLote = {
    numero: 1,
    titulo: "Abrir el lote",
    queHace: "Abre la tanda de revisión. Sin esto no se puede hacer nada más.",
    aclaracion: null,
    estado: hayLote ? "HECHO" : "AHORA",
  };

  const paso2: PasoDelLote = {
    numero: 2,
    titulo: "Revisar las fotos",
    queHace:
      "Controla cada foto contra las reglas: horario, formato, tamaño y repetidas. No decide si la foto es buena; eso es del jurado.",
    aclaracion:
      faltan > 1
        ? `Revisa ${s.porTanda} por vez. Quedan ${s.sinEvaluar} sin revisar: hay que apretarlo ${faltan} veces más.`
        : faltan === 1 && s.sinEvaluar > 0
          ? `Quedan ${s.sinEvaluar} sin revisar.`
          : s.requierenRevision > 0
            ? `${s.requierenRevision} necesitan que las mires vos antes de seguir.`
            : null,
    estado: !hayLote ? "ESPERA" : s.sinEvaluar > 0 || !seEvaluoAlgo ? "AHORA" : "HECHO",
  };

  const paso3: PasoDelLote = {
    numero: 3,
    titulo: "Cerrar el lote",
    queHace: "Corta la revisión: no entran más fotos a esta tanda.",
    aclaracion:
      s.requierenRevision > 0
        ? `Ojo: ${s.requierenRevision} todavía esperan tu decisión. Si cerrás ahora, quedan afuera.`
        : null,
    estado: cerrado ? "HECHO" : !hayLote || !seEvaluoAlgo ? "ESPERA" : "AHORA",
  };

  const paso4: PasoDelLote = {
    numero: 4,
    titulo: "Congelar para el jurado",
    queHace:
      "Le saca el nombre a cada foto, le pone un código anónimo y fija qué va a ver el jurado. Recién después de esto el jurado ve algo.",
    aclaracion: congelado
      ? null
      : "Se puede reabrir, pero si el jurado ya empezó a calificar, sus notas quedan apuntando a un estado que dejó de existir.",
    estado: congelado ? "HECHO" : cerrado ? "AHORA" : "ESPERA",
  };

  return [paso1, paso2, paso3, paso4];
}

/** Qué se le dice al organizador arriba de todo, según dónde esté parado. */
export function resumenDeLaSituacion(s: SituacionDelLote): string {
  if (s.estadoDelLote === "FROZEN") {
    return "Listo. Las obras están congeladas y el jurado ya puede verlas.";
  }
  if (s.estadoDelLote === null || s.estadoDelLote === "CANCELLED") {
    return "Todavía no empezaste. El primer paso es abrir el lote.";
  }
  if (s.sinEvaluar > 0) {
    const faltan = tandasQueFaltan(s.sinEvaluar, s.porTanda);
    return faltan > 1
      ? `Quedan ${s.sinEvaluar} fotos sin revisar. Apretá "Revisar las fotos" ${faltan} veces más.`
      : `Quedan ${s.sinEvaluar} fotos sin revisar.`;
  }
  if (s.requierenRevision > 0) {
    return `${s.requierenRevision} fotos esperan que las mires vos. El sistema no se anima a decidir solo.`;
  }
  if (s.estadoDelLote === "CLOSED") {
    return "El lote está cerrado. Falta congelarlo para que el jurado pueda ver las obras.";
  }
  return "Todas las fotos están revisadas. Podés cerrar el lote.";
}
