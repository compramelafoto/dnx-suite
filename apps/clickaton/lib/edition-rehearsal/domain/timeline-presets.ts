/**
 * Atajos del reloj del ensayo.
 *
 * Traducen el cronograma de una edición en momentos concretos a los que vale
 * la pena "viajar": la apertura de la inscripción, el minuto en que se liberan
 * las consignas, el cierre de la captura, y así.
 *
 * El momento de liberación no se calcula acá: se le pregunta a
 * `resolvePromptGate`, la misma función que usa el sitio para decidir si el
 * participante ve la cuenta regresiva o las consignas.
 */

import { systemClock, type EditionClock } from "@/lib/timeline/clock";
import { resolvePromptGate } from "@/lib/timeline/prompt-gate";
import type { TimelineEventType, TimelineEventView } from "@/lib/timeline/types";
import type { FotoDeEdicion } from "./types";

export type AtajoDeReloj = {
  id: string;
  etiqueta: string;
  /** `null` cuando la edición no tiene cargado el dato del que sale. */
  momento: Date | null;
  porQue: string;
};

const TIPOS_DE_EVENTO: TimelineEventType[] = [
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSE",
  "ACCREDITATION_OPEN",
  "ACCREDITATION_CLOSE",
  "MARATHON_START",
  "PROMPT_RELEASE",
  "CAPTURE_WINDOW_CLOSE",
  "UPLOAD_WINDOW_OPEN",
  "UPLOAD_WINDOW_CLOSE",
  "MARATHON_END",
  "JUDGING_OPEN",
  "JUDGING_CLOSE",
  "RESULTS_RELEASE",
  "CUSTOM",
];

function tipoDeEvento(valor: string): TimelineEventType {
  return TIPOS_DE_EVENTO.includes(valor as TimelineEventType)
    ? (valor as TimelineEventType)
    : "CUSTOM";
}

/** Adapta los eventos de la foto a la forma que espera el cronograma real. */
export function eventosParaElPorton(foto: FotoDeEdicion): TimelineEventView[] {
  return foto.eventos.map((e, indice) => ({
    id: e.id,
    eventType: tipoDeEvento(e.tipo),
    name: e.tipo,
    startsAt: e.comienzaEl,
    endsAt: null,
    status: e.estado,
    sequence: indice + 1,
    isCritical: false,
    visibilityPolicy: "PUBLIC_SAFE",
    triggerMode: "SCHEDULED",
    manuallyReleasedAt: null,
  }));
}

/** Momento en que se abren las consignas, según la regla real de la plataforma. */
export function momentoDeLiberacion(foto: FotoDeEdicion, clock: EditionClock): Date | null {
  const portón = resolvePromptGate({
    prompts: foto.consignas.map((c) => ({
      status: c.estado,
      releasedAt: c.liberadaEl,
      captureStartsAt: c.capturaAbreEl,
    })),
    events: eventosParaElPorton(foto),
    editionStartAt: foto.comienzaEl,
    clock,
  });
  return portón.opensAt;
}

function primero(fechas: Array<Date | null>): Date | null {
  const validas = fechas.filter((d): d is Date => d instanceof Date);
  if (validas.length === 0) return null;
  return validas.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
}

function ultimo(fechas: Array<Date | null>): Date | null {
  const validas = fechas.filter((d): d is Date => d instanceof Date);
  if (validas.length === 0) return null;
  return validas.reduce((max, d) => (d.getTime() > max.getTime() ? d : max));
}

function restarDias(fecha: Date | null, dias: number): Date | null {
  if (!fecha) return null;
  return new Date(fecha.getTime() - dias * 24 * 60 * 60_000);
}

function restarMinutos(fecha: Date | null, minutos: number): Date | null {
  if (!fecha) return null;
  return new Date(fecha.getTime() - minutos * 60_000);
}

function sumarMinutos(fecha: Date | null, minutos: number): Date | null {
  if (!fecha) return null;
  return new Date(fecha.getTime() + minutos * 60_000);
}

function puntoMedio(desde: Date | null, hasta: Date | null): Date | null {
  if (!desde || !hasta) return null;
  return new Date(Math.round((desde.getTime() + hasta.getTime()) / 2));
}

export function calcularAtajosDeReloj(
  foto: FotoDeEdicion,
  clock: EditionClock = systemClock(),
): AtajoDeReloj[] {
  const ahora = clock.now();
  const libera = momentoDeLiberacion(foto, clock);
  const capturaAbre =
    libera ?? primero(foto.consignas.map((c) => c.capturaAbreEl)) ?? foto.comienzaEl;
  const capturaCierra = ultimo(foto.consignas.map((c) => c.capturaCierraEl));
  const subidaCierra = ultimo(foto.consignas.map((c) => c.subidaCierraEl));

  const atajos: AtajoDeReloj[] = [
    {
      id: "ahora",
      etiqueta: "Ahora",
      momento: ahora,
      porQue: "La hora real de este momento.",
    },
    {
      id: "tres-dias-antes",
      etiqueta: "Tres días antes",
      momento: restarDias(foto.comienzaEl, 3),
      porQue: "Cuando la gente todavía se está inscribiendo.",
    },
    {
      id: "apertura-de-inscripcion",
      etiqueta: "Abre la inscripción",
      momento: foto.inscripcionAbreEl,
      porQue: "El primer minuto en que alguien puede anotarse.",
    },
    {
      id: "antes-del-cierre-de-inscripcion",
      etiqueta: "Justo antes de cerrar la inscripción",
      momento: restarMinutos(foto.inscripcionCierraEl, 1),
      porQue: "El último que se anota, con la fase de precio al límite.",
    },
    {
      id: "inicio-de-la-maraton",
      etiqueta: "Arranca la maratón",
      momento: foto.comienzaEl,
      porQue: "La hora de inicio cargada en la edición.",
    },
    {
      id: "liberacion-de-consignas",
      etiqueta: "Se liberan las consignas",
      momento: libera,
      porQue: "El instante en que la cuenta regresiva llega a cero.",
    },
    {
      id: "mitad-de-la-captura",
      etiqueta: "En plena captura",
      momento: puntoMedio(capturaAbre, capturaCierra),
      porQue: "Con la gente sacando fotos y subiendo.",
    },
    {
      id: "cierre-de-captura",
      etiqueta: "Cierra la captura",
      momento: capturaCierra,
      porQue: "Ya no se pueden sacar fotos nuevas.",
    },
    {
      id: "entre-captura-y-subida",
      etiqueta: "Captura cerrada, subida abierta",
      momento:
        capturaCierra && subidaCierra && subidaCierra.getTime() > capturaCierra.getTime()
          ? puntoMedio(sumarMinutos(capturaCierra, 1), subidaCierra)
          : null,
      porQue: "La franja para terminar de cargar lo que ya se sacó.",
    },
    {
      id: "cierre-de-subida",
      etiqueta: "Cierra la subida",
      momento: subidaCierra,
      porQue: "El último minuto para cargar una foto.",
    },
    {
      id: "despues-de-todo",
      etiqueta: "Después de todo",
      momento: sumarMinutos(subidaCierra ?? foto.terminaEl, 60),
      porQue: "Con la maratón terminada, para ver qué queda a la vista.",
    },
  ];

  // Los resueltos, en orden cronológico; los que no se pueden calcular, al final.
  const conMomento = atajos
    .filter((a) => a.momento !== null)
    .sort((a, b) => a.momento!.getTime() - b.momento!.getTime());
  const sinMomento = atajos.filter((a) => a.momento === null);
  return [...conMomento, ...sinMomento];
}
