import type { TimelineEventType } from "@/lib/timeline/types";

/**
 * Los horarios de la edición, vistos como tramos.
 *
 * El cronograma guarda eventos sueltos (apertura y cierre por separado). Para
 * cargarlos sin equivocarse conviene verlos como barras: "acreditación de 14:00
 * a 16:30". Un tramo agrupa el par de eventos que ya existe; no hay modelo
 * nuevo, y el motor de cronograma no se toca.
 */

export type DefinicionTramo = {
  id: string;
  nombre: string;
  ayuda: string;
  desde: TimelineEventType;
  /** `null` = es un momento puntual, no un rango. */
  hasta: TimelineEventType | null;
};

export const TRAMOS_CRONOGRAMA: DefinicionTramo[] = [
  {
    id: "inscripciones",
    nombre: "Inscripciones",
    ayuda: "Mientras esté abierta, la gente puede anotarse y pagar.",
    desde: "REGISTRATION_OPEN",
    hasta: "REGISTRATION_CLOSE",
  },
  {
    id: "acreditacion",
    nombre: "Acreditación",
    ayuda: "Ventana para escanear los QR en sede.",
    desde: "ACCREDITATION_OPEN",
    hasta: "ACCREDITATION_CLOSE",
  },
  {
    id: "consignas",
    nombre: "Publicación de consignas",
    ayuda: "Momento exacto en que se abren todas juntas.",
    desde: "PROMPT_RELEASE",
    hasta: null,
  },
  {
    id: "captura",
    nombre: "Toma de fotos",
    ayuda: "Las fotos válidas tienen que estar tomadas dentro de esta franja.",
    desde: "MARATHON_START",
    hasta: "CAPTURE_WINDOW_CLOSE",
  },
  {
    id: "subida",
    nombre: "Subida de fotos",
    ayuda:
      "Puede abrir junto con la toma y seguir abierta después, como margen para entregar.",
    desde: "UPLOAD_WINDOW_OPEN",
    hasta: "UPLOAD_WINDOW_CLOSE",
  },
  {
    id: "jurado",
    nombre: "Jurado",
    ayuda: "Evaluación. No lo ve el participante.",
    desde: "JUDGING_OPEN",
    hasta: "JUDGING_CLOSE",
  },
  {
    id: "resultados",
    nombre: "Resultados",
    ayuda: "Cuándo se publican los ganadores.",
    desde: "RESULTS_RELEASE",
    hasta: null,
  },
];

export type EventoParaTramo = {
  id: string;
  eventType: string;
  startsAt: Date | null;
};

export type Tramo = {
  id: string;
  nombre: string;
  ayuda: string;
  /** `null` cuando el evento no existe en este cronograma. */
  desdeEventId: string | null;
  hastaEventId: string | null;
  desde: Date | null;
  hasta: Date | null;
  esHito: boolean;
};

export function construirTramos(eventos: EventoParaTramo[]): Tramo[] {
  const porTipo = new Map(eventos.map((e) => [e.eventType, e]));
  return TRAMOS_CRONOGRAMA.map((d) => {
    const inicio = porTipo.get(d.desde) ?? null;
    const fin = d.hasta ? (porTipo.get(d.hasta) ?? null) : null;
    return {
      id: d.id,
      nombre: d.nombre,
      ayuda: d.ayuda,
      desdeEventId: inicio?.id ?? null,
      hastaEventId: fin?.id ?? null,
      desde: inicio?.startsAt ?? null,
      hasta: d.hasta ? (fin?.startsAt ?? null) : (inicio?.startsAt ?? null),
      esHito: d.hasta === null,
    };
  });
}

/**
 * Qué está mal en cada tramo, en el idioma de quien carga los horarios.
 * Devuelve `null` cuando el tramo está bien.
 */
export function validarTramo(tramo: Tramo, todos: Tramo[]): string | null {
  if (!tramo.desde) return "Falta cargar un horario.";
  if (!tramo.esHito && !tramo.hasta) return "Falta cargar un horario.";
  if (!tramo.esHito && tramo.hasta && tramo.hasta.getTime() <= tramo.desde.getTime()) {
    return "El final llega antes que el comienzo.";
  }

  const buscar = (id: string) => todos.find((t) => t.id === id);
  const captura = buscar("captura");
  const subida = buscar("subida");
  const consignas = buscar("consignas");

  if (tramo.id === "subida" && captura?.hasta && tramo.hasta) {
    if (tramo.hasta.getTime() < captura.hasta.getTime()) {
      return "La entrega cierra antes de que termine la toma de fotos.";
    }
  }
  if (tramo.id === "subida" && captura?.desde && tramo.desde) {
    if (tramo.desde.getTime() > captura.desde.getTime()) {
      return "La entrega abre después de que ya se puede fotografiar.";
    }
  }
  if (tramo.id === "captura" && consignas?.desde && tramo.desde) {
    if (tramo.desde.getTime() < consignas.desde.getTime()) {
      return "Se puede fotografiar antes de que se publiquen las consignas.";
    }
  }
  if (tramo.id === "captura" && subida?.hasta && tramo.hasta) {
    if (subida.hasta.getTime() < tramo.hasta.getTime()) {
      return "La toma termina después de que cerró la entrega.";
    }
  }
  return null;
}

export function contarProblemas(tramos: Tramo[]): number {
  return tramos.filter((t) => validarTramo(t, tramos) !== null).length;
}
