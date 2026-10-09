/**
 * Si hay que leer el texto de las fotos de un álbum.
 *
 * Leer texto cuesta: Amazon cobra USD 1 cada 1.000 fotos, y es **la mitad** de la
 * factura. En una maratón sirve —el dorsal es como el cliente se encuentra—, pero en un
 * casamiento, un acto escolar o un cumpleaños no hay ningún número que buscar y se paga
 * igual.
 *
 * Hasta el 2026-10-09 corría en todas: el cron llamaba a `/api/internal/analysis/run`
 * con `?ocr=1`, que lo forzaba. En septiembre fueron 55.722 fotos leídas, de las cuales
 * la enorme mayoría no tenía nada que leer.
 *
 * Ahora manda el tipo de álbum, y lo pedido a mano sigue pudiendo forzarlo para
 * reprocesar un caso puntual.
 */

/** Único tipo de álbum donde la lectura de texto se enciende sola. */
const TIPO_CON_TEXTO_UTIL = "SPORTS";

export type OcrDecisionInput = {
  /** `Album.type`. En producción la mayoría de los álbumes lo tiene vacío. */
  albumType: string | null;
  /** `?ocr=1` / `?ocr=0`. `null` cuando nadie lo pidió explícitamente. */
  requested: boolean | null;
};

export function shouldRunOcr({ albumType, requested }: OcrDecisionInput): boolean {
  if (requested !== null) return requested;
  return albumType === TIPO_CON_TEXTO_UTIL;
}
