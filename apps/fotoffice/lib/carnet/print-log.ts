import type { FulfillmentState } from "./fulfillment";

/**
 * La descarga del PDF de imprenta, anotada en la historia del carnet.
 *
 * El recorrido guardaba quién marcó «impreso», pero no quién bajó el archivo —que es el acto
 * que realmente manda a imprimir, y el que saca del sistema la foto y los datos del socio—.
 * Sin esto, ante «¿quién mandó a imprimir este carnet?» no había nada que mirar.
 *
 * Se anota como un hecho **sin cambio de estado**: el carnet sigue donde estaba. Por eso
 * origen y destino son el mismo, que es justo lo que una transición nunca puede ser.
 */

export const PDF_DOWNLOAD_NOTE = "Descargó el PDF para imprimir";

export type CardEventData = {
  cardId: string;
  fromState: FulfillmentState;
  toState: FulfillmentState;
  actorUserId: number | null;
  actorLabel: string | null;
  note: string;
};

export function buildPdfDownloadEvent(input: {
  cardId: string;
  state: FulfillmentState;
  actorUserId: number | null;
  actorLabel: string | null;
}): CardEventData {
  return {
    cardId: input.cardId,
    fromState: input.state,
    toState: input.state,
    actorUserId: input.actorUserId,
    actorLabel: input.actorLabel,
    note: PDF_DOWNLOAD_NOTE,
  };
}

export function isPdfDownloadEvent(event: {
  fromState: FulfillmentState | null;
  toState: FulfillmentState;
  note: string | null;
}): boolean {
  return event.fromState === event.toState && event.note === PDF_DOWNLOAD_NOTE;
}
